import { Accessory, Appearance, BeardStyle, BodyType, HairStyle, OutfitStyle } from './character.model';

export const SPRITE_WIDTH = 32;
export const SPRITE_HEIGHT = 48;

export interface Pixel {
  x: number;
  y: number;
  fill: string;
}

/**
 * The sprite is painted as named materials first. A lighting pass then adds a
 * highlight on each region's top edge and a shadow on its right and bottom
 * edges, and a final pass draws a dark outline around the silhouette.
 */
type Material =
  | 'skin'
  | 'skinDark'
  | 'hair'
  | 'eyeWhite'
  | 'iris'
  | 'mouth'
  | 'main'
  | 'mainDark'
  | 'accent'
  | 'pants'
  | 'belt'
  | 'boots'
  | 'metal'
  | 'buckle'
  | 'shirt'
  | 'tie'
  | 'lens'
  | 'frame'
  | 'rim'
  | 'lash'
  | 'gold';

/** Materials that are too small or too dark to look right with edge lighting. */
const FLAT: ReadonlySet<Material> = new Set(['skinDark', 'eyeWhite', 'iris', 'mouth', 'buckle', 'frame', 'rim', 'lash', 'lens', 'gold']);

const OUTLINE = '#140c1c';

class Canvas {
  readonly grid: (Material | null)[][] = Array.from({ length: SPRITE_HEIGHT }, () =>
    Array<Material | null>(SPRITE_WIDTH).fill(null),
  );

  set(x: number, y: number, m: Material | null): void {
    if (x >= 0 && y >= 0 && x < SPRITE_WIDTH && y < SPRITE_HEIGHT) this.grid[y][x] = m;
  }

  rect(x: number, y: number, w: number, h: number, m: Material | null): void {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.set(x + dx, y + dy, m);
  }

  /** Paints a horizontal span per row: rows[i] = [fromX, toX] for row y + i. */
  rows(y: number, rows: [number, number][], m: Material | null): void {
    rows.forEach(([from, to], i) => this.rect(from, y + i, to - from + 1, 1, m));
  }

  /** Mirrors a span across the body's vertical center line. */
  mirror(x: number, y: number, w: number, h: number, m: Material | null): void {
    this.rect(x, y, w, h, m);
    this.rect(SPRITE_WIDTH - x - w, y, w, h, m);
  }

  get(x: number, y: number): Material | null {
    return this.grid[y]?.[x] ?? null;
  }
}

function drawBody(c: Canvas): void {
  // Head with rounded corners, ears and neck.
  c.rows(4, [[12, 19], [11, 20], [11, 20], [11, 20], [11, 20], [11, 20], [11, 20], [11, 20], [11, 20], [12, 19], [13, 18]], 'skin');
  c.mirror(10, 9, 1, 3, 'skin');
  c.rect(14, 15, 4, 3, 'skin');
  // Torso, arms, fists.
  c.rows(18, [[9, 22], [8, 23], [8, 23]], 'skin');
  c.rect(9, 21, 14, 10, 'skin');
  c.mirror(5, 19, 4, 12, 'skin');
  c.mirror(5, 31, 4, 3, 'skin');
  c.mirror(6, 32, 2, 1, 'skinDark');
  // Hips, legs, feet.
  c.rect(10, 31, 12, 3, 'skin');
  c.mirror(10, 34, 5, 10, 'skin');
  c.mirror(9, 44, 6, 2, 'skin');
}

function drawFace(c: Canvas): void {
  c.mirror(13, 10, 2, 1, 'eyeWhite');
  c.set(14, 10, 'iris');
  c.set(17, 10, 'iris');
  c.mirror(13, 9, 2, 1, 'hair');
  c.rect(15, 12, 1, 1, 'skinDark');
  c.rect(15, 14, 2, 1, 'mouth');
}

function drawOutfit(c: Canvas, style: OutfitStyle): void {
  switch (style) {
    case 'shirt':
      c.rows(18, [[9, 22], [8, 23], [8, 23]], 'main');
      c.rect(9, 21, 14, 10, 'main');
      c.mirror(5, 19, 4, 7, 'main');
      c.mirror(5, 26, 4, 1, 'mainDark');
      c.mirror(13, 17, 2, 2, 'mainDark');
      drawTie(c, 18, 28);
      c.mirror(15, 22, 1, 1, 'mainDark');
      c.rect(10, 31, 12, 1, 'belt');
      c.rect(15, 31, 2, 1, 'buckle');
      drawSlacks(c, 'pants');
      return;
    case 'suit':
      c.rows(18, [[9, 22], [8, 23], [8, 23]], 'main');
      c.rect(9, 21, 14, 12, 'main');
      c.rows(18, [[13, 18], [13, 18], [14, 17], [14, 17], [14, 17], [15, 16], [15, 16]], 'shirt');
      c.mirror(13, 17, 2, 1, 'shirt');
      drawTie(c, 18, 25);
      c.rows(18, [[12, 12], [12, 12], [12, 13], [13, 13], [13, 13], [14, 14], [14, 14]], 'mainDark');
      c.rows(18, [[19, 19], [19, 19], [18, 19], [18, 18], [18, 18], [17, 17], [17, 17]], 'mainDark');
      c.set(16, 27, 'buckle');
      c.set(16, 29, 'buckle');
      c.mirror(5, 19, 4, 11, 'main');
      c.mirror(5, 30, 4, 1, 'shirt');
      drawSlacks(c, 'main');
      return;
    case 'casual':
      c.rows(18, [[9, 22], [8, 23], [8, 23]], 'main');
      c.rect(9, 21, 14, 10, 'main');
      c.rows(18, [[14, 17], [15, 16]], 'shirt');
      c.mirror(13, 17, 2, 2, 'shirt');
      c.rect(9, 18, 1, 13, 'mainDark');
      c.rect(9, 29, 14, 2, 'mainDark');
      c.rect(10, 31, 12, 1, 'shirt');
      c.mirror(5, 19, 4, 11, 'main');
      c.mirror(5, 29, 4, 1, 'mainDark');
      drawSlacks(c, 'pants');
      return;
    case 'blouse':
      c.rows(18, [[9, 22], [8, 23], [8, 23]], 'main');
      c.rect(9, 21, 14, 10, 'main');
      c.rows(18, [[14, 17], [15, 16]], 'skin');
      c.mirror(13, 17, 2, 2, 'mainDark');
      c.mirror(5, 19, 4, 6, 'main');
      c.rect(10, 31, 12, 1, 'belt');
      c.rows(32, [[10, 21], [10, 21], [9, 22], [9, 22], [9, 22], [8, 23], [8, 23]], 'pants');
      c.mirror(9, 44, 6, 2, 'boots');
      c.mirror(11, 44, 3, 1, 'skin');
      return;
    case 'uniform':
      c.rows(18, [[9, 22], [8, 23], [8, 23]], 'main');
      c.rect(9, 21, 14, 10, 'main');
      c.rows(18, [[14, 17], [15, 16]], 'shirt');
      drawTie(c, 18, 22);
      c.mirror(7, 18, 4, 1, 'gold');
      c.rect(10, 22, 4, 1, 'tie');
      c.rect(10, 23, 4, 1, 'gold');
      c.rect(11, 24, 2, 1, 'accent');
      c.rect(19, 22, 2, 2, 'gold');
      c.mirror(5, 19, 4, 12, 'main');
      c.mirror(5, 29, 4, 1, 'gold');
      c.rect(9, 30, 14, 2, 'belt');
      c.rect(15, 30, 2, 2, 'buckle');
      c.rect(10, 32, 12, 2, 'main');
      c.mirror(10, 34, 5, 6, 'main');
      c.mirror(10, 40, 5, 4, 'boots');
      c.mirror(9, 44, 6, 2, 'boots');
      return;
    case 'gi':
      c.rows(18, [[9, 13], [8, 14], [8, 14], [9, 14]], 'main');
      c.rows(18, [[18, 22], [17, 23], [17, 23], [17, 22]], 'main');
      c.rect(9, 22, 14, 9, 'main');
      c.mirror(5, 19, 4, 8, 'main');
      c.rect(9, 31, 14, 2, 'belt');
      c.rect(12, 33, 2, 3, 'belt');
      c.rect(10, 33, 12, 1, 'main');
      c.mirror(10, 34, 5, 9, 'main');
      return;
    case 'tanktop':
      c.rows(19, [[10, 21], [10, 21]], 'main');
      c.mirror(10, 18, 2, 1, 'main');
      c.rect(10, 21, 12, 10, 'main');
      drawJeans(c);
      return;
    case 'jacket':
      c.rows(18, [[9, 22], [8, 23], [8, 23]], 'main');
      c.rect(9, 21, 14, 10, 'main');
      c.rows(18, [[14, 17], [14, 17], [15, 16]], 'accent');
      c.rect(14, 21, 4, 10, 'accent');
      c.mirror(12, 18, 2, 4, 'mainDark');
      c.mirror(5, 19, 4, 12, 'main');
      c.mirror(5, 29, 4, 1, 'mainDark');
      drawJeans(c);
      return;
    case 'hoodie':
      c.rows(15, [[11, 13], [10, 13], [10, 13]], 'mainDark');
      c.rows(15, [[18, 20], [18, 21], [18, 21]], 'mainDark');
      c.rows(18, [[9, 22], [8, 23], [8, 23]], 'main');
      c.rect(9, 21, 14, 11, 'main');
      c.rect(12, 26, 8, 4, 'mainDark');
      c.mirror(14, 19, 1, 4, 'accent');
      c.mirror(5, 19, 4, 12, 'main');
      c.mirror(5, 30, 4, 1, 'mainDark');
      c.rect(10, 32, 12, 2, 'pants');
      c.mirror(10, 34, 5, 10, 'pants');
      c.mirror(9, 44, 6, 2, 'boots');
      return;
    case 'ninja':
      c.rows(4, [[12, 19], [11, 20], [11, 20], [11, 20], [11, 20]], 'main');
      c.rect(11, 6, 10, 1, 'accent');
      c.rows(11, [[11, 20], [11, 20], [11, 20], [12, 19], [13, 18]], 'main');
      c.rect(14, 15, 4, 3, 'main');
      c.mirror(10, 9, 1, 3, 'main');
      c.rows(18, [[9, 22], [8, 23], [8, 23]], 'main');
      c.rect(9, 21, 14, 10, 'main');
      c.mirror(5, 19, 4, 12, 'main');
      c.mirror(5, 26, 4, 2, 'mainDark');
      c.rect(9, 30, 14, 2, 'accent');
      c.rect(10, 32, 12, 2, 'main');
      c.mirror(10, 34, 5, 10, 'main');
      c.mirror(10, 40, 5, 4, 'mainDark');
      c.mirror(9, 44, 6, 2, 'mainDark');
      return;
    case 'wrestler':
      c.mirror(10, 18, 2, 5, 'main');
      c.rect(10, 23, 12, 8, 'main');
      c.rect(9, 30, 14, 2, 'belt');
      c.rect(14, 30, 4, 2, 'buckle');
      c.rect(10, 32, 12, 3, 'main');
      c.mirror(10, 35, 5, 1, 'main');
      c.mirror(10, 40, 5, 4, 'accent');
      c.mirror(9, 44, 6, 2, 'accent');
      c.mirror(5, 31, 4, 1, 'accent');
      return;
    case 'armor':
      c.rows(17, [[7, 11], [7, 11], [7, 10]], 'metal');
      c.rows(17, [[20, 24], [20, 24], [21, 24]], 'metal');
      c.rect(9, 18, 14, 13, 'metal');
      c.rect(13, 20, 6, 13, 'main');
      c.rect(14, 22, 4, 2, 'accent');
      c.mirror(5, 20, 4, 11, 'mainDark');
      c.mirror(5, 27, 4, 4, 'metal');
      c.rect(9, 31, 4, 2, 'belt');
      c.rect(19, 31, 4, 2, 'belt');
      c.mirror(10, 34, 5, 10, 'pants');
      c.mirror(10, 37, 5, 2, 'metal');
      c.mirror(9, 41, 6, 5, 'metal');
      return;
  }
}

function drawAccessory(c: Canvas, accessory: Accessory): void {
  switch (accessory) {
    case 'none':
      return;
    case 'glasses':
      c.mirror(12, 11, 4, 1, 'rim');
      c.mirror(12, 10, 1, 1, 'rim');
      c.mirror(15, 10, 1, 1, 'rim');
      c.mirror(12, 9, 1, 1, 'rim');
      c.mirror(15, 9, 1, 1, 'rim');
      c.mirror(10, 9, 2, 1, 'rim');
      return;
    case 'sunglasses':
      c.rect(11, 9, 10, 1, 'frame');
      c.mirror(12, 10, 4, 2, 'lens');
      c.mirror(13, 10, 1, 1, 'shirt');
      return;
    case 'headset':
      c.rows(2, [[13, 18], [11, 12]], 'frame');
      c.rows(3, [[19, 20]], 'frame');
      c.mirror(10, 4, 1, 4, 'frame');
      c.mirror(9, 8, 2, 4, 'frame');
      c.rect(11, 12, 1, 2, 'frame');
      c.rect(12, 14, 2, 1, 'frame');
      c.set(14, 14, 'gold');
      return;
    case 'cap':
      c.rows(0, [[12, 19], [11, 20], [10, 21], [10, 21], [10, 21]], 'mainDark');
      c.rect(10, 4, 12, 1, 'gold');
      c.rect(10, 5, 12, 1, 'frame');
      c.rect(9, 6, 14, 1, 'frame');
      c.rect(15, 1, 2, 2, 'gold');
      return;
  }
}

/** Widens (positive) or narrows (negative) the rows between y0 and y1 around the center line. */
function reshape(c: Canvas, y0: number, y1: number, amount: number): void {
  const half = SPRITE_WIDTH / 2;
  for (let y = y0; y <= y1; y++) {
    const row = c.grid[y];
    const out: (Material | null)[] = Array<Material | null>(SPRITE_WIDTH).fill(null);
    for (let x = 0; x < half; x++) {
      const nx = x - amount;
      if (nx >= 0 && nx < half) out[nx] = row[x];
    }
    for (let x = half; x < SPRITE_WIDTH; x++) {
      const nx = x + amount;
      if (nx >= half && nx < SPRITE_WIDTH) out[nx] = row[x];
    }
    for (let i = 0; i < amount; i++) {
      out[half - 1 - i] ??= row[half - 1];
      out[half + i] ??= row[half];
    }
    c.grid[y] = out;
  }
}

function applyBody(c: Canvas, body: BodyType): void {
  if (body === 'heavy') {
    reshape(c, 17, 33, 2);
    reshape(c, 24, 31, 1);
    reshape(c, 15, 16, 1);
  } else if (body === 'slim') {
    reshape(c, 17, 33, -1);
  }
}

function drawTie(c: Canvas, from: number, to: number): void {
  c.rect(15, from, 2, to - from, 'tie');
  c.rect(14, to - 2, 4, 2, 'tie');
  c.rect(15, to, 2, 1, 'tie');
}

function drawSlacks(c: Canvas, m: Material): void {
  c.rect(10, 32, 12, 2, m);
  c.mirror(10, 34, 5, 10, m);
  c.mirror(9, 44, 6, 2, 'boots');
}

function drawJeans(c: Canvas): void {
  c.rect(10, 31, 12, 1, 'belt');
  c.rect(15, 31, 2, 1, 'buckle');
  c.rect(10, 32, 12, 2, 'pants');
  c.mirror(10, 34, 5, 10, 'pants');
  c.mirror(9, 44, 6, 2, 'boots');
}

function drawHair(c: Canvas, style: HairStyle): void {
  const cap = (): void => {
    c.rows(2, [[13, 18], [12, 19], [11, 20], [11, 20], [11, 20]], 'hair');
    c.mirror(11, 7, 1, 3, 'hair');
  };
  switch (style) {
    case 'short':
      cap();
      c.rect(15, 7, 3, 1, 'hair');
      return;
    case 'spiky':
      cap();
      c.rows(0, [[12, 12], [11, 13]], 'hair');
      c.rows(0, [[16, 16], [15, 17]], 'hair');
      c.rows(0, [[20, 20], [19, 21]], 'hair');
      c.mirror(9, 3, 2, 2, 'hair');
      c.rect(12, 7, 2, 1, 'hair');
      c.rect(16, 7, 3, 1, 'hair');
      return;
    case 'long':
      cap();
      c.rect(12, 7, 8, 1, 'hair');
      c.mirror(9, 5, 2, 17, 'hair');
      c.mirror(11, 10, 1, 4, 'hair');
      return;
    case 'mohawk':
      c.rows(0, [[15, 16], [14, 17], [14, 17], [14, 17], [14, 17], [14, 17], [15, 16]], 'hair');
      return;
    case 'ponytail':
      cap();
      c.rect(12, 7, 8, 1, 'hair');
      c.rows(5, [[21, 22], [21, 23], [22, 24], [22, 24], [23, 25], [23, 25], [23, 25], [23, 24]], 'hair');
      return;
    case 'afro':
      c.rows(0, [[13, 18], [11, 20], [10, 21], [9, 22], [9, 22], [9, 22], [9, 22]], 'hair');
      c.mirror(9, 7, 2, 4, 'hair');
      return;
    case 'receding':
      c.mirror(11, 5, 1, 5, 'hair');
      c.mirror(10, 6, 1, 3, 'hair');
      c.mirror(12, 4, 1, 2, 'hair');
      c.set(15, 3, 'hair');
      c.set(17, 3, 'hair');
      // Forehead wrinkles.
      c.rect(14, 6, 4, 1, 'skinDark');
      c.mirror(13, 12, 1, 1, 'skinDark');
      return;
    case 'bald':
      return;
  }
}

function drawBeard(c: Canvas, style: BeardStyle): void {
  const mustache = (): void => c.rows(13, [[14, 17]], 'hair');
  switch (style) {
    case 'none':
      return;
    case 'stubble':
      for (let y = 12; y <= 15; y++) {
        for (let x = 12; x <= 19; x++) {
          if ((x + y) % 2 === 0 && c.get(x, y) === 'skin' && !(y === 12 && x > 13 && x < 18)) c.set(x, y, 'hair');
        }
      }
      return;
    case 'mustache':
      mustache();
      c.mirror(13, 14, 1, 1, 'hair');
      return;
    case 'goatee':
      mustache();
      c.rows(15, [[14, 17], [15, 16]], 'hair');
      return;
    case 'full':
      mustache();
      c.mirror(11, 10, 2, 5, 'hair');
      c.mirror(13, 14, 2, 1, 'hair');
      c.rows(15, [[12, 19], [13, 18]], 'hair');
      return;
    case 'long':
      mustache();
      c.mirror(11, 10, 2, 5, 'hair');
      c.mirror(13, 14, 2, 1, 'hair');
      c.rows(15, [[12, 19], [12, 19], [13, 18], [13, 18], [14, 17], [14, 17], [15, 16]], 'hair');
      return;
  }
}

function adjust(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number): string => {
    const v = (n >> shift) & 0xff;
    const out = amount < 0 ? v * (1 + amount) : v + (255 - v) * amount;
    return Math.round(out).toString(16).padStart(2, '0');
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

const PANTS: Partial<Record<OutfitStyle, string>> = {
  hoodie: '#6b6f78',
  shirt: '#3a3f4a',
  casual: '#c2ab7f',
  blouse: '#2b2f3a',
};

function palette(look: Appearance): Record<Material, string> {
  return {
    skin: look.skinColor,
    skinDark: adjust(look.skinColor, -0.25),
    hair: look.hairColor,
    eyeWhite: '#f4f4f4',
    iris: look.eyeColor,
    mouth: look.bodyType === 'slim' ? '#b03a48' : adjust(look.skinColor, -0.45),
    main: look.outfitColor,
    mainDark: adjust(look.outfitColor, -0.35),
    accent: look.outfitStyle === 'ninja' || look.outfitStyle === 'armor' ? '#d4a017' : '#f0f0f0',
    pants: PANTS[look.outfitStyle] ?? '#2f3e5c',
    belt: look.outfitStyle === 'gi' ? '#1c1c1c' : '#5a3d1e',
    boots: look.outfitStyle === 'casual' ? '#6b4423' : '#2a2226',
    metal: '#9aa5b1',
    buckle: '#e8c547',
    shirt: '#eef1f5',
    lens: '#14141f',
    frame: '#1c1c22',
    rim: '#4a4f5c',
    lash: '#1c1c22',
    gold: '#e8c547',
    tie: look.outfitStyle === 'shirt' ? '#25365c' : '#8b1e2d',
  };
}

export function spritePixels(look: Appearance): Pixel[] {
  const c = new Canvas();
  drawBody(c);
  drawOutfit(c, look.outfitStyle);
  if (look.outfitStyle !== 'ninja') {
    drawFace(c);
    drawBeard(c, look.beardStyle);
    drawHair(c, look.hairStyle);
    drawAccessory(c, look.accessory ?? 'none');
  } else {
    c.mirror(13, 9, 2, 2, 'eyeWhite');
    c.set(14, 10, 'iris');
    c.set(17, 10, 'iris');
  }
  if (look.bodyType === 'slim' && look.outfitStyle !== 'ninja') {
    c.set(12, 9, 'lash');
    c.set(19, 9, 'lash');
  }
  applyBody(c, look.bodyType ?? 'normal');

  const colors = palette(look);
  const pixels: Pixel[] = [];
  for (let y = 0; y < SPRITE_HEIGHT; y++) {
    for (let x = 0; x < SPRITE_WIDTH; x++) {
      const m = c.get(x, y);
      if (m === null) {
        const touches = [c.get(x - 1, y), c.get(x + 1, y), c.get(x, y - 1), c.get(x, y + 1)].some((n) => n !== null);
        if (touches) pixels.push({ x, y, fill: OUTLINE });
        continue;
      }
      let fill = colors[m];
      if (!FLAT.has(m)) {
        if (c.get(x, y - 1) !== m) fill = adjust(fill, 0.18);
        else if (c.get(x + 1, y) !== m || c.get(x, y + 1) !== m) fill = adjust(fill, -0.28);
      }
      pixels.push({ x, y, fill });
    }
  }
  return pixels;
}
