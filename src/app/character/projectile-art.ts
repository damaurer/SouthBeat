/**
 * Player-drawn projectiles: 12×12 pixels, one character per pixel.
 * '.' is transparent, '0'–'f' pick a color from the palette.
 */
export const ART_SIZE = 12;

export const ART_PALETTE: Record<string, string> = {
  '0': '#140c1c',
  '1': '#ffffff',
  '2': '#9aa5b1',
  '3': '#4a4f5c',
  '4': '#d62828',
  '5': '#f48024',
  '6': '#f1c40f',
  '7': '#2ecc71',
  '8': '#2b9348',
  '9': '#5ad1ff',
  a: '#2a6fdb',
  b: '#8e44ad',
  c: '#ff8fb1',
  d: '#6f3b1a',
  e: '#c8a06a',
  f: '#e0ac69',
};

export const ART_PRESETS: Record<string, { label: string; art: string[] }> = {
  coffee: {
    label: 'Kaffeetasse',
    art: [
      '............',
      '...1...1....',
      '....1...1...',
      '............',
      '.000000000..',
      '.0dddddd0...',
      '.01111110000',
      '.01111110..0',
      '.01111110..0',
      '.01111110000',
      '..0111110...',
      '...00000....',
    ],
  },
  bug: {
    label: 'Bug',
    art: [
      '............',
      '..0......0..',
      '...0.00.0...',
      '....0000....',
      '..00444400..',
      '.0.404404.0.',
      '...444444...',
      '.0.440044.0.',
      '...444444...',
      '.0..4444..0.',
      '.....00.....',
      '............',
    ],
  },
  floppy: {
    label: 'Diskette',
    art: [
      '.aaaaaaaaaa.',
      '.aa22220aaa.',
      '.aa22220aaa.',
      '.aa22220aaa.',
      '.aaaaaaaaaa.',
      '.aa111111aa.',
      '.aa111111aa.',
      '.aa111111aa.',
      '.aa111111aa.',
      '.aa111111aa.',
      '.aaaaaaaaaa.',
      '............',
    ],
  },
  tomato: {
    label: 'Tomate',
    art: [
      '............',
      '.....88.....',
      '...888888...',
      '..44488444..',
      '.4444444444.',
      '.4114444444.',
      '.4144444444.',
      '.4444444444.',
      '.4444444444.',
      '..44444444..',
      '...444444...',
      '............',
    ],
  },
};

export const DEFAULT_ART = ART_PRESETS['coffee'].art;

export function emptyArt(): string[] {
  return Array.from({ length: ART_SIZE }, () => '.'.repeat(ART_SIZE));
}

export function isValidArt(art: unknown): art is string[] {
  return (
    Array.isArray(art) &&
    art.length === ART_SIZE &&
    art.every((row) => typeof row === 'string' && row.length === ART_SIZE && /^[.0-9a-f]+$/.test(row))
  );
}

export function paintArtCell(art: string[], x: number, y: number, value: string): string[] {
  if (art[y]?.[x] === undefined || art[y][x] === value) return art;
  const next = [...art];
  next[y] = art[y].slice(0, x) + value + art[y].slice(x + 1);
  return next;
}
