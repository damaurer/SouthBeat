/** A tiny pixel canvas that works the same in the browser, on the server and in tests. */
export class Painter {
  readonly pixels: string[];

  constructor(
    readonly width: number,
    readonly height: number,
    background = '#000000',
  ) {
    this.pixels = Array<string>(width * height).fill(background);
  }

  set(x: number, y: number, color: string): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.pixels[y * this.width + x] = color;
  }

  get(x: number, y: number): string {
    return this.pixels[y * this.width + x];
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.set(x + dx, y + dy, color);
  }

  hline(x: number, y: number, w: number, color: string): void {
    this.rect(x, y, w, 1, color);
  }

  vline(x: number, y: number, h: number, color: string): void {
    this.rect(x, y, 1, h, color);
  }

  /** One-pixel border around a rectangle. */
  frame(x: number, y: number, w: number, h: number, color: string): void {
    this.hline(x, y, w, color);
    this.hline(x, y + h - 1, w, color);
    this.vline(x, y, h, color);
    this.vline(x + w - 1, y, h, color);
  }

  /** Vertical gradient in hard bands, with a dithered row between bands. */
  bands(x: number, y: number, w: number, h: number, colors: readonly string[]): void {
    const band = h / colors.length;
    for (let dy = 0; dy < h; dy++) {
      const i = Math.min(colors.length - 1, Math.floor(dy / band));
      const edge = i < colors.length - 1 && dy === Math.floor((i + 1) * band) - 1;
      for (let dx = 0; dx < w; dx++) {
        this.set(x + dx, y + dy, edge && (dx + dy) % 2 === 0 ? colors[i + 1] : colors[i]);
      }
    }
  }

  dither(x: number, y: number, w: number, h: number, a: string, b: string): void {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.set(x + dx, y + dy, (dx + dy) % 2 ? b : a);
  }

  /** Writes text in a 3×5 pixel font and returns the width used. */
  text(x: number, y: number, text: string, color: string): number {
    let cx = x;
    for (const ch of text.toUpperCase()) {
      const glyph = FONT[ch];
      if (glyph) {
        glyph.split('/').forEach((row, gy) =>
          row.split('').forEach((bit, gx) => {
            if (bit === '1') this.set(cx + gx, y + gy, color);
          }),
        );
      }
      cx += 4;
    }
    return cx - x - 1;
  }

  /** Paints sprite pixels with their top-left at (x, y), optionally mirrored. */
  sprite(x: number, y: number, pixels: { x: number; y: number; fill: string }[], width: number, mirror = false): void {
    for (const p of pixels) this.set(x + (mirror ? width - 1 - p.x : p.x), y + p.y, p.fill);
  }

  toRgba(): Uint8ClampedArray<ArrayBuffer> {
    const data = new Uint8ClampedArray(this.pixels.length * 4);
    this.pixels.forEach((hex, i) => {
      const n = parseInt(hex.slice(1), 16);
      data[i * 4] = (n >> 16) & 0xff;
      data[i * 4 + 1] = (n >> 8) & 0xff;
      data[i * 4 + 2] = n & 0xff;
      data[i * 4 + 3] = 255;
    });
    return data;
  }
}

/** Deterministic random numbers so every arena looks the same on every device. */
export function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number): string => {
    const v = (n >> shift) & 0xff;
    const out = amount < 0 ? v * (1 + amount) : v + (255 - v) * amount;
    return Math.round(out).toString(16).padStart(2, '0');
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

const FONT: Record<string, string> = {
  A: '010/101/111/101/101', B: '110/101/110/101/110', C: '011/100/100/100/011', D: '110/101/101/101/110',
  E: '111/100/110/100/111', F: '111/100/110/100/100', G: '011/100/101/101/011', H: '101/101/111/101/101',
  I: '111/010/010/010/111', J: '001/001/001/101/010', K: '101/101/110/101/101', L: '100/100/100/100/111',
  M: '101/111/111/101/101', N: '110/101/101/101/101', O: '010/101/101/101/010', P: '110/101/110/100/100',
  Q: '010/101/101/110/011', R: '110/101/110/101/101', S: '011/100/010/001/110', T: '111/010/010/010/010',
  U: '101/101/101/101/111', V: '101/101/101/101/010', W: '101/101/111/111/101', X: '101/101/010/101/101',
  Y: '101/101/010/010/010', Z: '111/001/010/100/111', '0': '111/101/101/101/111', '1': '010/110/010/010/111',
  '2': '110/001/010/100/111', '3': '110/001/010/001/110', '4': '101/101/111/001/001', '5': '111/100/110/001/110',
  '6': '011/100/111/101/111', '7': '111/001/010/010/010', '8': '111/101/111/101/111', '9': '111/101/111/001/110',
  '-': '000/000/111/000/000', '!': '010/010/010/000/010', '.': '000/000/000/000/010', ':': '000/010/000/010/000',
  '/': '001/001/010/100/100', '<': '001/010/100/010/001', '>': '100/010/001/010/100', '{': '011/010/110/010/011',
  '}': '110/010/011/010/110', ';': '000/010/000/010/100', '=': '000/111/000/111/000', '(': '010/100/100/100/010',
  ')': '010/001/001/001/010', '?': '110/001/010/000/010', '#': '101/111/101/111/101',
};
