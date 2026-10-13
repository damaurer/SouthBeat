import { Appearance, BODY_SHAPE_KEYS, shapeValue } from './character.model';
import { BodyPart, JOINTS, PartPixel } from './profile';

/** Joint positions of one figure; they move when the sliders stretch body, arms or legs. */
export interface Joints {
  neck: readonly [number, number];
  shoulder: readonly [number, number];
  elbow: readonly [number, number];
  hipBack: readonly [number, number];
  hipFront: readonly [number, number];
  knee: number;
}

/** Shoes keep their size; the legs stretch above them, so the feet stay on the floor. */
const SHOE_TOP = 44;
const CENTRE_X = 16.5;

/**
 * Applies the body sliders (height, build, shoulders, belly, head, arms, legs) to the
 * side view at rest, before any pose. The engines never see this: it changes the look,
 * not reach or hitboxes, so every fighter stays as fast and as hittable as before.
 */
export function reshape(look: Appearance, pixels: PartPixel[]): { pixels: PartPixel[]; joints: Joints } {
  if (BODY_SHAPE_KEYS.every((key) => shapeValue(look, key) === 0)) return { pixels, joints: JOINTS };
  const v = (key: (typeof BODY_SHAPE_KEYS)[number]): number => shapeValue(look, key);
  const torsoY = 1 + 0.05 * v('height');
  const legY = 1 + 0.07 * v('legs') + 0.04 * v('height');
  const armY = 1 + 0.08 * v('arms') + 0.03 * v('height');
  const headScale = 1 + 0.07 * v('head');
  const build = 1 + 0.12 * v('build');
  const shoulders = 0.12 * v('shoulders');
  const belly = 1.3 * v('belly');

  const hipY = SHOE_TOP - (SHOE_TOP - JOINTS.hipFront[1]) * legY;
  const fromHip = (y: number): number => hipY + (y - JOINTS.hipFront[1]) * torsoY;
  const neck: [number, number] = [JOINTS.neck[0], fromHip(JOINTS.neck[1])];
  const shoulder: [number, number] = [JOINTS.shoulder[0], fromHip(JOINTS.shoulder[1])];
  const joints: Joints = {
    neck,
    shoulder,
    elbow: [JOINTS.elbow[0], shoulder[1] + (JOINTS.elbow[1] - JOINTS.shoulder[1]) * armY],
    hipBack: [JOINTS.hipBack[0], hipY],
    hipFront: [JOINTS.hipFront[0], hipY],
    knee: SHOE_TOP - (SHOE_TOP - JOINTS.knee) * legY,
  };

  // Source pixels per part, looked up by position.
  const source = new Map<BodyPart, Map<number, PartPixel>>();
  const key = (x: number, y: number): number => (y + 64) * 256 + (x + 64);
  for (const px of pixels) {
    let grid = source.get(px.part);
    if (!grid) source.set(px.part, (grid = new Map()));
    grid.set(key(px.x, px.y), px);
  }
  // Left and right edge of the torso in each row, to widen it row by row.
  const rows = new Map<number, [number, number]>();
  for (const px of pixels) {
    if (px.part !== 'body') continue;
    const r = rows.get(px.y);
    rows.set(px.y, r ? [Math.min(r[0], px.x), Math.max(r[1], px.x + 1)] : [px.x, px.x + 1]);
  }
  const widthAt = (y: number): number => build * (1 + shoulders * Math.max(0, Math.min(1, (26 - y) / 6)));
  const bulgeAt = (y: number): number => belly * Math.max(0, 1 - Math.abs(y - 28) / 5);

  /** Where a target pixel centre comes from in the unshaped figure, per part. */
  const inverse = (part: BodyPart, x: number, y: number): [number, number] | null => {
    switch (part) {
      case 'head':
        return [neck[0] + (x - neck[0]) / headScale, JOINTS.neck[1] + (y - neck[1]) / headScale];
      case 'body': {
        const sy = JOINTS.hipFront[1] + (y - hipY) / torsoY;
        const edges = rows.get(Math.floor(sy));
        if (!edges) return null;
        const [left, right] = edges;
        const wide = widthAt(sy);
        const l = CENTRE_X - (CENTRE_X - left) * wide;
        const r = CENTRE_X + (right - CENTRE_X) * wide + bulgeAt(sy);
        if (x < l || x > r) return null;
        return [left + ((x - l) * (right - left)) / (r - l), sy];
      }
      case 'armBack':
      case 'foreBack':
      case 'armFront':
      case 'foreFront':
        return [x, JOINTS.shoulder[1] + (y - shoulder[1]) / armY];
      default:
        return [x, y >= SHOE_TOP ? y : SHOE_TOP + (y - SHOE_TOP) / legY];
    }
  };

  const out: PartPixel[] = [];
  for (const [part, grid] of source) {
    for (let y = -24; y < 48; y++) {
      for (let x = -12; x < 44; x++) {
        const from = inverse(part, x + 0.5, y + 0.5);
        if (!from) continue;
        const px = grid.get(key(Math.floor(from[0]), Math.floor(from[1])));
        if (px) out.push({ x, y, fill: px.fill, part });
      }
    }
  }
  return { pixels: out, joints };
}
