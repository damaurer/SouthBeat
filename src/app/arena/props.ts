import { Painter, seeded, shade } from './painter';

export const ARENA_WIDTH = 240;
export const ARENA_HEIGHT = 135;
/** Where the back wall meets the floor. */
export const FLOOR_Y = 100;
/** Where the fighters' feet touch the floor. */
export const GROUND_Y = 128;

const OUTLINE = '#140c1c';
const CODE_COLORS = ['#7ec8e3', '#c792ea', '#c3e88d', '#ffcb6b', '#f78c6c', '#89ddff'];

export function wall(p: Painter, color: string): void {
  p.rect(0, 0, ARENA_WIDTH, FLOOR_Y, color);
  p.hline(0, FLOOR_Y - 3, ARENA_WIDTH, shade(color, -0.3));
  p.rect(0, FLOOR_Y - 2, ARENA_WIDTH, 2, shade(color, -0.45));
}

export type FloorKind = 'tiles' | 'carpet' | 'wood' | 'concrete' | 'raised';

export function floor(p: Painter, color: string, kind: FloorKind, seed = 1): void {
  const rnd = seeded(seed);
  const dark = shade(color, -0.2);
  const light = shade(color, 0.12);
  p.rect(0, FLOOR_Y, ARENA_WIDTH, ARENA_HEIGHT - FLOOR_Y, color);
  for (let y = FLOOR_Y; y < ARENA_HEIGHT; y++) {
    const depth = y - FLOOR_Y;
    switch (kind) {
      case 'tiles':
      case 'raised': {
        const size = kind === 'raised' ? 20 : 16;
        if (depth % 7 === 0) p.hline(0, y, ARENA_WIDTH, dark);
        for (let x = 0; x < ARENA_WIDTH; x += size) {
          // Seams fan out from the center to suggest perspective.
          const sx = Math.round(x + ((x - ARENA_WIDTH / 2) * depth) / 60);
          p.set(sx, y, dark);
          if (kind === 'raised' && depth % 7 === 3 && (x / size) % 2 === 0) p.set(sx + 3, y, '#5a6470');
        }
        break;
      }
      case 'wood':
        if (depth % 4 === 0) p.hline(0, y, ARENA_WIDTH, dark);
        for (let x = (depth * 13) % 37; x < ARENA_WIDTH; x += 37) p.set(x, y, dark);
        break;
      case 'carpet':
        for (let x = 0; x < ARENA_WIDTH; x++) if (rnd() < 0.08) p.set(x, y, rnd() < 0.5 ? dark : light);
        break;
      case 'concrete':
        for (let x = 0; x < ARENA_WIDTH; x++) if (rnd() < 0.05) p.set(x, y, rnd() < 0.6 ? dark : light);
        break;
    }
  }
  p.hline(0, FLOOR_Y, ARENA_WIDTH, light);
}

/** A window looking out on a city skyline. */
export function cityWindow(
  p: Painter,
  x: number,
  y: number,
  w: number,
  h: number,
  sky: readonly string[],
  options: { night?: boolean; frame?: string; seed?: number; mullions?: number } = {},
): void {
  const rnd = seeded(options.seed ?? x + y);
  p.bands(x, y, w, h, sky);
  const building = options.night ? '#1b1d33' : '#7a8ba3';
  const lit = options.night ? '#ffd56b' : '#c8d6e8';
  let bx = x;
  while (bx < x + w) {
    const bw = 6 + Math.floor(rnd() * 10);
    const bh = Math.floor(h * (0.25 + rnd() * 0.5));
    const top = y + h - bh;
    p.rect(bx, top, Math.min(bw, x + w - bx), bh, rnd() < 0.5 ? building : shade(building, -0.15));
    for (let wy = top + 2; wy < y + h - 1; wy += 3) {
      for (let wx = bx + 1; wx < Math.min(bx + bw, x + w) - 1; wx += 2) {
        if (rnd() < (options.night ? 0.35 : 0.5)) p.set(wx, wy, lit);
      }
    }
    bx += bw;
  }
  const frame = options.frame ?? '#d9dde3';
  p.frame(x - 1, y - 1, w + 2, h + 2, frame);
  const panes = options.mullions ?? 2;
  for (let i = 1; i < panes; i++) p.vline(x + Math.round((w * i) / panes), y, h, frame);
  p.hline(x - 2, y + h + 1, w + 4, shade(frame, -0.25));
}

export function ceilingLamp(p: Painter, x: number, y: number, w: number, glow = '#fffbe6'): void {
  p.rect(x, y, w, 2, '#c9cdd3');
  p.hline(x + 1, y + 2, w - 2, glow);
}

export function monitor(p: Painter, x: number, y: number, w: number, h: number, seed: number, screen = '#1e2433'): void {
  const rnd = seeded(seed);
  p.rect(x, y, w, h, OUTLINE);
  p.rect(x + 1, y + 1, w - 2, h - 2, screen);
  for (let ly = y + 2; ly < y + h - 2; ly += 2) {
    let lx = x + 2 + Math.floor(rnd() * 3);
    while (lx < x + w - 3) {
      const len = 1 + Math.floor(rnd() * 4);
      p.hline(lx, ly, Math.min(len, x + w - 2 - lx), CODE_COLORS[Math.floor(rnd() * CODE_COLORS.length)]);
      lx += len + 1;
    }
  }
  p.rect(x + Math.floor(w / 2) - 1, y + h, 2, 2, '#3a3f4a');
  p.hline(x + Math.floor(w / 2) - 3, y + h + 2, 6, '#3a3f4a');
}

/** A desk whose top surface is at `top`; returns nothing, draws monitors on it. */
export function desk(p: Painter, x: number, top: number, w: number, color: string, seed: number, monitors = 2): void {
  const legs = shade(color, -0.4);
  for (let i = 0; i < monitors; i++) {
    const mw = 14;
    const mx = x + 3 + i * (mw + 3);
    monitor(p, mx, top - 13, mw, 10, seed + i);
  }
  p.rect(x + w - 8, top - 3, 3, 3, '#f2f2f2');
  p.set(x + w - 5, top - 2, '#f2f2f2');
  p.rect(x + 4, top - 1, 10, 1, '#2b2f3a');
  p.rect(x, top, w, 2, color);
  p.hline(x, top + 2, w, shade(color, -0.25));
  p.rect(x + 1, top + 3, 2, FLOOR_Y - top - 1, legs);
  p.rect(x + w - 3, top + 3, 2, FLOOR_Y - top - 1, legs);
}

export function officeChair(p: Painter, x: number, color = '#2b2f3a'): void {
  p.rect(x, FLOOR_Y - 20, 8, 9, color);
  p.rect(x - 1, FLOOR_Y - 11, 10, 2, color);
  p.vline(x + 4, FLOOR_Y - 9, 6, '#6b6f78');
  p.hline(x, FLOOR_Y - 3, 9, '#6b6f78');
  p.set(x, FLOOR_Y - 2, OUTLINE);
  p.set(x + 8, FLOOR_Y - 2, OUTLINE);
}

export function plant(p: Painter, x: number, base = FLOOR_Y, pot = '#b5651d'): void {
  const leaf = '#3f8f3a';
  const leafLight = '#6cc551';
  p.rect(x, base - 8, 8, 8, pot);
  p.hline(x - 1, base - 8, 10, shade(pot, 0.2));
  const leaves: [number, number][] = [[3, -12], [1, -14], [5, -15], [-1, -11], [7, -12], [3, -18], [0, -17], [6, -19], [4, -21], [2, -10]];
  for (const [lx, ly] of leaves) {
    p.rect(x + lx, base + ly, 3, 2, leaf);
    p.set(x + lx + 1, base + ly, leafLight);
  }
}

export function serverRack(p: Painter, x: number, y: number, w: number, h: number, seed: number, led = '#39ff88'): void {
  const rnd = seeded(seed);
  p.rect(x, y, w, h, '#1a1d24');
  p.frame(x, y, w, h, '#3a3f4a');
  for (let uy = y + 2; uy < y + h - 2; uy += 3) {
    p.hline(x + 2, uy, w - 4, '#2b2f3a');
    for (let lx = x + 2; lx < x + w - 2; lx += 2) {
      if (rnd() < 0.3) p.set(lx, uy + 1, rnd() < 0.8 ? led : '#ff5a5a');
    }
  }
}

export function whiteboard(p: Painter, x: number, y: number, w: number, h: number, lines: string[]): void {
  p.rect(x, y, w, h, '#f4f6f8');
  p.frame(x, y, w, h, '#9aa5b1');
  p.hline(x + 2, y + h, w - 4, '#9aa5b1');
  const inks = ['#2a6fdb', '#d62828', '#2b9348', '#222222'];
  lines.forEach((line, i) => p.text(x + 3, y + 3 + i * 7, line, inks[i % inks.length]));
}

export function sign(p: Painter, x: number, y: number, text: string, bg: string, fg: string): number {
  const w = text.length * 4 + 3;
  p.rect(x, y, w, 9, bg);
  p.frame(x, y, w, 9, shade(bg, -0.35));
  p.text(x + 2, y + 2, text, fg);
  return w;
}

/** Glowing neon letters with a soft halo. */
export function neon(p: Painter, x: number, y: number, text: string, color: string, wallColor: string): void {
  const halo = shade(wallColor, 0.25);
  const probe = new Painter(text.length * 4 + 2, 7, '#000000');
  probe.text(1, 1, text, '#ffffff');
  for (let py = 0; py < probe.height; py++) {
    for (let px = 0; px < probe.width; px++) {
      if (probe.get(px, py) !== '#ffffff') continue;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) p.set(x + px + dx, y + py + dy, halo);
    }
  }
  p.text(x + 1, y + 1, text, color);
}

export function bookshelf(p: Painter, x: number, y: number, w: number, h: number, seed: number): void {
  const rnd = seeded(seed);
  const wood = '#6b4423';
  p.rect(x, y, w, h, wood);
  const books = ['#c0392b', '#2980b9', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22', '#ecf0f1'];
  for (let sy = y + 2; sy < y + h - 2; sy += 10) {
    p.rect(x + 2, sy, w - 4, 8, shade(wood, -0.45));
    let bx = x + 2;
    while (bx < x + w - 3) {
      const bh = 5 + Math.floor(rnd() * 3);
      const bw = 1 + Math.floor(rnd() * 2);
      p.rect(bx, sy + 8 - bh, bw, bh, books[Math.floor(rnd() * books.length)]);
      bx += bw + (rnd() < 0.2 ? 1 : 0);
    }
    p.hline(x, sy + 8, w, shade(wood, 0.15));
  }
}

export function coffeeMachine(p: Painter, x: number, base: number): void {
  p.rect(x, base - 14, 10, 14, '#2b2f3a');
  p.rect(x + 1, base - 13, 8, 3, '#4a4f5c');
  p.set(x + 2, base - 12, '#39ff88');
  p.rect(x + 3, base - 8, 4, 1, '#9aa5b1');
  p.rect(x + 3, base - 4, 4, 4, '#f2f2f2');
  p.set(x + 7, base - 3, '#f2f2f2');
}

export function pizzaBoxes(p: Painter, x: number, base: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const y = base - 3 * (i + 1);
    p.rect(x + (i % 2), y, 14, 3, '#d9b77e');
    p.hline(x + (i % 2), y, 14, '#ecd3a5');
    p.set(x + 6 + (i % 2), y + 1, '#c0392b');
  }
}

export function stringLights(p: Painter, x1: number, x2: number, y: number, sag: number, colors: readonly string[]): void {
  for (let x = x1; x <= x2; x++) {
    const t = (x - x1) / (x2 - x1);
    const ly = Math.round(y + sag * 4 * t * (1 - t));
    p.set(x, ly, '#3a3f4a');
    if ((x - x1) % 6 === 3) {
      p.set(x, ly + 1, colors[((x - x1) / 6) % colors.length | 0]);
      p.set(x, ly + 2, colors[((x - x1) / 6) % colors.length | 0]);
    }
  }
}
