import { Painter, seeded, shade } from '../arena/painter';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../arena/props';
import { Appearance, MoveSlot, findMove } from '../character/character.model';
import { SPRITE_HEIGHT, SPRITE_WIDTH } from '../character/sprite';
import { Animated, poseFor } from '../fight/animate';
import { posedSprite } from '../fight/pose';

/**
 * The animated title background: a night skyline scrolling in three parallax layers,
 * and two programmers sparring on a rooftop in front of it.
 */
const W = ARENA_WIDTH;
const H = ARENA_HEIGHT;
const ROOF_Y = 112;
const LAYER_WIDTH = W * 2;

interface Layer {
  pixels: Painter;
  speed: number;
}

export class TitleScene {
  private readonly sky: Painter;
  private readonly layers: Layer[];
  private readonly stars: { x: number; y: number; phase: number }[];

  constructor() {
    const r = seeded(7);
    this.sky = new Painter(W, H);
    this.sky.bands(0, 0, W, ROOF_Y, ['#0b0b1f', '#141433', '#21204a', '#3a2a5e', '#6b3a6b', '#b0546a']);
    this.stars = Array.from({ length: 40 }, () => ({ x: Math.floor(r() * W), y: Math.floor(r() * 50), phase: Math.floor(r() * 60) }));
    this.layers = [
      { pixels: skyline(r, '#241c3f', 30, 70, 0.15, '#4a3a6a'), speed: 0.1 },
      { pixels: skyline(r, '#1a1430', 45, 85, 0.25, '#ffcf6b'), speed: 0.25 },
      { pixels: skyline(r, '#0f0c1f', 60, 98, 0.35, '#ffe66d'), speed: 0.5 },
    ];
  }

  render(frame: number, left: Appearance, right: Appearance): Painter {
    const p = this.sky.clone();
    for (const s of this.stars) if ((frame + s.phase) % 90 > 8) p.set(s.x, s.y, (frame + s.phase) % 30 < 15 ? '#ffffff' : '#aab4ff');
    // Moon.
    for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) if (dx * dx + dy * dy <= 49) p.set(196 + dx, 22 + dy, dx * dx + dy * dy > 30 ? '#e8e2c8' : '#fff8dc');
    for (const layer of this.layers) {
      const offset = Math.floor(frame * layer.speed) % LAYER_WIDTH;
      for (let y = 0; y < ROOF_Y; y++) {
        for (let x = 0; x < W; x++) {
          const c = layer.pixels.get((x + offset) % LAYER_WIDTH, y);
          if (c !== '#000000') p.set(x, y, c);
        }
      }
    }
    roof(p, frame);
    this.fighters(p, frame, left, right);
    return p;
  }

  /** A sparring loop: the fighters take turns with a punch, a haymaker or a kick, and the one hit reels back. */
  private fighters(p: Painter, frame: number, left: Appearance, right: Appearance): void {
    const cycle = frame % 120;
    const round = Math.floor(frame / 120);
    const leftTurn = round % 2 === 0;
    const slot = SPARRING[Math.floor(round / 2) % SPARRING.length];
    const lunge = cycle >= 60 && cycle < 72 ? Math.min(cycle - 60, 6) : cycle >= 72 && cycle < 84 ? Math.max(0, 84 - cycle) / 2 : 0;
    const hit = cycle >= 66 && cycle < 80;
    const recoil = hit ? 3 : 0;
    const idle: Animated = { action: null, hitstun: 0, knockedDown: false, downFrames: 0, walkFrames: 0, hp: 1 };
    const move = findMove(SPARRING_MOVES[slot])!;
    const attacker: Animated = cycle >= 52 && cycle < 90 ? { ...idle, action: { slot, move, frame: cycle - 52, startup: 10, active: 6, total: 38 } } : idle;
    const target: Animated = hit ? { ...idle, hitstun: 80 - cycle } : idle;
    const lx = 86 + (leftTurn ? lunge : -recoil);
    const rx = 154 - (leftTurn ? -recoil : lunge);
    this.draw(p, left, lx, ROOF_Y + 14 - SPRITE_HEIGHT, false, leftTurn ? attacker : target, frame, !leftTurn && hit && frame % 4 < 2);
    this.draw(p, right, rx, ROOF_Y + 14 - SPRITE_HEIGHT, true, leftTurn ? target : attacker, frame + 17, leftTurn && hit && frame % 4 < 2);
    if (hit) {
      const sx = leftTurn ? rx - 10 : lx + 10;
      const rad = 3 + (cycle - 66) / 2;
      const y = slot === 'kick' ? ROOF_Y - 2 : ROOF_Y - 16;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        p.set(sx + Math.cos(a) * rad, y + Math.sin(a) * rad, frame % 4 < 2 ? '#ffffff' : '#ffe66d');
      }
    }
  }

  private draw(p: Painter, look: Appearance, x: number, top: number, mirror: boolean, state: Animated, frame: number, flash: boolean): void {
    const cx = Math.round(x);
    const pixels = posedSprite(look, poseFor(state, frame));
    // Shadow.
    for (let dx = -8; dx < 8; dx++) p.set(cx + dx, top + SPRITE_HEIGHT, shade(p.get(Math.max(0, Math.min(W - 1, cx + dx)), Math.min(H - 1, top + SPRITE_HEIGHT)), -0.4));
    p.sprite(Math.round(cx - SPRITE_WIDTH / 2), top, flash ? pixels.map((px) => ({ ...px, fill: '#ffffff' })) : pixels, SPRITE_WIDTH, mirror);
  }
}

const SPARRING: MoveSlot[] = ['light', 'heavy', 'kick'];
const SPARRING_MOVES: Record<string, string> = { light: 'keyboard-jab', heavy: 'monitor-slam', kick: 'chair-spin' };

/** One layer of office towers with lit windows, twice the screen wide so it can wrap. */
function skyline(r: () => number, color: string, minTop: number, maxTop: number, lit: number, light: string): Painter {
  const p = new Painter(LAYER_WIDTH, ROOF_Y, '#000000');
  let x = 0;
  while (x < LAYER_WIDTH) {
    const w = 14 + Math.floor(r() * 22);
    const top = minTop + Math.floor(r() * (maxTop - minTop));
    p.rect(x, top, Math.min(w, LAYER_WIDTH - x), ROOF_Y - top, color);
    if (r() < 0.3) p.rect(x + Math.floor(w / 2) - 1, top - 6, 1, 6, color);
    for (let wy = top + 3; wy < ROOF_Y - 2; wy += 4) {
      for (let wx = x + 2; wx < x + w - 2 && wx < LAYER_WIDTH - 1; wx += 3) {
        if (r() < lit) p.rect(wx, wy, 1, 2, r() < 0.15 ? '#9fd8ff' : light);
      }
    }
    x += w + Math.floor(r() * 4);
  }
  return p;
}

function roof(p: Painter, frame: number): void {
  p.bands(0, ROOF_Y, W, H - ROOF_Y, ['#3b3b4f', '#2e2e40', '#24243a']);
  for (let x = 0; x < W; x += 2) p.set(x + ((x >> 3) % 2), ROOF_Y + 6 + ((x * 7) % 9), '#4a4a60');
  for (let x = 0; x < W; x++) p.set(x, ROOF_Y, Math.floor((x + frame / 4) / 6) % 2 ? '#f2c230' : '#1a1a1a');
  // Air conditioning units with a turning fan.
  for (const ax of [12, 206]) {
    p.rect(ax, ROOF_Y - 14, 22, 14, '#8a93a3');
    p.rect(ax + 1, ROOF_Y - 13, 20, 1, '#b8c0cc');
    const blade = Math.floor(frame / 4) % 2;
    p.rect(ax + 6, ROOF_Y - 11, 10, 9, '#3a404a');
    p.rect(ax + (blade ? 7 : 10), ROOF_Y - (blade ? 7 : 10), blade ? 8 : 2, blade ? 2 : 8, '#c8ced8');
  }
}
