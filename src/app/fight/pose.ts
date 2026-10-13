import { Appearance } from '../character/character.model';
import { BodyPart, PartPixel, Pivots, Pixel, SPRITE_HEIGHT, SPRITE_WIDTH, spriteParts } from '../character/sprite';

/**
 * A fighter's posture in one frame. Angles are in radians: 0 lets an arm or leg hang
 * straight down, positive values swing it forward (towards the opponent), negative ones
 * behind the body. Offsets are in sprite pixels; positive y moves down.
 */
export interface Pose {
  x: number;
  y: number;
  /** Upper body tilting forward (+) or back (−) around the hips. */
  lean: number;
  head: number;
  armBack: number;
  armFront: number;
  /** Pushes an arm further out along its direction, as in a punch. */
  reachBack: number;
  reachFront: number;
  legBack: number;
  legFront: number;
  /** Shortens the legs, for crouching and tucked jumps; 1 is full length. */
  legScale: number;
  /** Turns the whole figure around its feet: −π/2 lies on its back. */
  roll: number;
  /** Squeezes the figure towards the floor, for lying on it. */
  flatten: number;
}

export const NEUTRAL: Pose = {
  x: 0,
  y: 0,
  lean: 0,
  head: 0,
  armBack: 0,
  armFront: 0,
  reachBack: 0,
  reachFront: 0,
  legBack: 0,
  legFront: 0,
  legScale: 1,
  roll: 0,
  flatten: 1,
};

export function pose(p: Partial<Pose>): Pose {
  return { ...NEUTRAL, ...p };
}

/** Blends two poses: t = 0 gives a, t = 1 gives b. */
export function blend(a: Pose, b: Pose, t: number): Pose {
  const k = Math.max(0, Math.min(1, t));
  const out = { ...a };
  for (const key of Object.keys(a) as (keyof Pose)[]) out[key] = a[key] + (b[key] - a[key]) * k;
  return out;
}

interface Rig {
  parts: Record<BodyPart, PartPixel[]>;
  pivots: Pivots;
  cache: Map<string, Pixel[]>;
}

const rigs = new WeakMap<Appearance, Rig>();

function rigFor(look: Appearance): Rig {
  let rig = rigs.get(look);
  if (!rig) {
    const { pixels, pivots } = spriteParts(look);
    const parts: Record<BodyPart, PartPixel[]> = { head: [], body: [], armBack: [], armFront: [], legBack: [], legFront: [] };
    for (const px of pixels) parts[px.part].push(px);
    rig = { parts, pivots, cache: new Map() };
    rigs.set(look, rig);
  }
  return rig;
}

type Point = [number, number];
type Transform = (x: number, y: number) => Point;

/** Turns a point around a centre; a positive angle swings "down" towards "forward" (+x). */
function turn(cx: number, cy: number, angle: number): Transform {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * cos + dy * sin, cy - dx * sin + dy * cos];
  };
}

const then =
  (first: Transform, second: Transform): Transform =>
  (x, y) =>
    second(...first(x, y));

// The posed figure is drawn into a grid larger than the sprite, so limbs can reach out.
const MARGIN_X = 28;
const MARGIN_Y = 24;
const GRID_W = SPRITE_WIDTH + MARGIN_X * 2;
const GRID_H = SPRITE_HEIGHT + MARGIN_Y;
const OUTLINE = '#140c1c';
const FEET: Point = [SPRITE_WIDTH / 2, SPRITE_HEIGHT - 2];
const LEG_LENGTH = 12;
const HIPS: Point = [SPRITE_WIDTH / 2, 33];

/** Parts drawn back to front. */
const ORDER: BodyPart[] = ['armBack', 'legBack', 'legFront', 'body', 'head', 'armFront'];

/**
 * The fighter's pixels in the given pose, relative to the sprite's top-left corner
 * (some can lie outside the 32 × 48 box). Drawn facing right, outline included.
 */
export function posedSprite(look: Appearance, p: Pose): Pixel[] {
  const rig = rigFor(look);
  const q = (v: number, step: number): number => Math.round(v / step);
  const key = [p.x, p.y, p.reachBack, p.reachFront].map((v) => q(v, 1)).concat(
    [p.lean, p.head, p.armBack, p.armFront, p.legBack, p.legFront, p.roll].map((v) => q(v, 0.04)),
    [p.legScale, p.flatten].map((v) => q(v, 0.05)),
  ).join(',');
  const hit = rig.cache.get(key);
  if (hit) return hit;

  const grid: (string | null)[] = Array(GRID_W * GRID_H).fill(null);
  const { pivots } = rig;
  const move: Transform = (x, y) => [x + p.x, y + p.y];
  // Parts above their pivot (body, head, the whole figure) tilt forward with a negative turn.
  const body = then(turn(HIPS[0], HIPS[1], -p.lean), move);
  // Crouching lowers the hips; the legs get shorter so the feet stay on the floor.
  const legScale = p.legScale !== 1 ? p.legScale : Math.max(0.3, 1 - Math.max(0, p.y) / LEG_LENGTH);
  const whole: Transform = (x, y) => {
    const [rx, ry] = turn(FEET[0], FEET[1], -p.roll)(x, y);
    return [rx, FEET[1] + (ry - FEET[1]) * p.flatten];
  };
  const limb = (part: BodyPart): Transform => {
    switch (part) {
      case 'body':
        return body;
      case 'head':
        return then(turn(...pivots.head, -p.head), body);
      case 'armBack':
      case 'armFront': {
        const [cx, cy] = pivots[part];
        const angle = part === 'armBack' ? p.armBack : p.armFront;
        const reach = part === 'armBack' ? p.reachBack : p.reachFront;
        const out: Transform = (x, y) => [x + Math.sin(angle) * reach, y + Math.cos(angle) * reach];
        return then(then(turn(cx, cy, angle), out), body);
      }
      case 'legBack':
      case 'legFront': {
        const [cx, cy] = pivots[part];
        const angle = part === 'legBack' ? p.legBack : p.legFront;
        const squash: Transform = (x, y) => [x, cy + (y - cy) * legScale];
        return then(then(squash, turn(cx, cy, angle)), move);
      }
    }
  };
  for (const part of ORDER) {
    const t = then(limb(part), whole);
    for (const px of rig.parts[part]) {
      // Four samples per pixel close the gaps a rotation would otherwise leave.
      for (const [ox, oy] of SAMPLES) {
        const [gx, gy] = t(px.x + ox, px.y + oy);
        const ix = Math.floor(gx) + MARGIN_X;
        const iy = Math.floor(gy) + MARGIN_Y;
        if (ix >= 0 && iy >= 0 && ix < GRID_W && iy < GRID_H) grid[iy * GRID_W + ix] = px.fill;
      }
    }
  }
  const pixels: Pixel[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const fill = grid[y * GRID_W + x];
      if (fill) {
        pixels.push({ x: x - MARGIN_X, y: y - MARGIN_Y, fill });
        continue;
      }
      const at = (dx: number, dy: number): string | null => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < GRID_W && ny < GRID_H ? grid[ny * GRID_W + nx] : null;
      };
      if (at(-1, 0) || at(1, 0) || at(0, -1) || at(0, 1)) pixels.push({ x: x - MARGIN_X, y: y - MARGIN_Y, fill: OUTLINE });
    }
  }
  if (rig.cache.size > 400) rig.cache.clear();
  rig.cache.set(key, pixels);
  return pixels;
}

const SAMPLES: Point[] = [
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
];
