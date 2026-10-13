import { Appearance, HairStyle } from './character.model';

export const SPRITE_WIDTH = 16;
export const SPRITE_HEIGHT = 22;

// S skin, E eye, T torso, A arm, B belt, P pants, F feet
const BODY = [
  '................',
  '................',
  '......SSSS......',
  '.....SSSSSS.....',
  '.....SESSES.....',
  '.....SSSSSS.....',
  '......SSSS......',
  '.......SS.......',
  '....TTTTTTTT....',
  '...ATTTTTTTTA...',
  '...ATTTTTTTTA...',
  '...ATTTTTTTTA...',
  '...STTTTTTTTS...',
  '....BBBBBBBB....',
  '....PPPPPPPP....',
  '....PPP..PPP....',
  '....PPP..PPP....',
  '....PPP..PPP....',
  '....PPP..PPP....',
  '....PPP..PPP....',
  '....PPP..PPP....',
  '...FFFF..FFFF...',
];

// Hair layers only paint their H cells on top of the body.
const HAIR: Record<HairStyle, string[]> = {
  short: ['................', '......HHHH......', '.....HHHHHH.....', '.....H....H.....'],
  spiky: ['....H.H..H.H....', '.....HHHHHH.....', '....HHHHHHHH....', '.....H....H.....'],
  long: [
    '................',
    '......HHHH......',
    '.....HHHHHH.....',
    '.....H....H.....',
    '.....H....H.....',
    '.....H....H.....',
    '.....H....H.....',
    '.....H....H.....',
  ],
  bald: [],
};

const SHIRT = '#f4f4f4';

export interface Pixel {
  x: number;
  y: number;
  fill: string;
}

export function spritePixels(look: Appearance): Pixel[] {
  const gi = look.outfitStyle === 'gi';
  const palette: Record<string, string> = {
    S: look.skinColor,
    E: '#111111',
    T: look.outfitColor,
    A: look.outfitStyle === 'tanktop' ? look.skinColor : look.outfitColor,
    B: gi ? '#111111' : '#5a3d1e',
    P: gi ? look.outfitColor : '#2c2c34',
    F: '#222222',
    H: look.hairColor,
  };

  const grid = BODY.map((row) => row.split(''));
  HAIR[look.hairStyle].forEach((row, y) =>
    row.split('').forEach((cell, x) => {
      if (cell === 'H') grid[y][x] = 'H';
    }),
  );

  const pixels: Pixel[] = [];
  grid.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell === '.') return;
      const shirt = look.outfitStyle === 'jacket' && cell === 'T' && (x === 7 || x === 8);
      pixels.push({ x, y, fill: shirt ? SHIRT : palette[cell] });
    }),
  );
  return pixels;
}
