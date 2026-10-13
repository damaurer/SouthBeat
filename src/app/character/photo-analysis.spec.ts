import { analyzePhoto, isSkin } from './photo-analysis';

interface Portrait {
  skin: string;
  hair?: string;
  longHair?: boolean;
  beard?: string;
  glasses?: 'frames' | 'dark';
  shirt: string;
  jacket?: string;
}

/** Draws a simple test portrait: head, hair, optional beard and glasses, upper body. */
function portrait(p: Portrait): ImageData {
  const c = document.createElement('canvas');
  c.width = 120;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7fb3e0';
  g.fillRect(0, 0, 120, 160);
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string): void => {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  };
  // Body first, the head is drawn on top.
  g.fillStyle = p.jacket ?? p.shirt;
  g.fillRect(15, 105, 90, 55);
  if (p.jacket) {
    g.fillStyle = p.shirt;
    g.fillRect(50, 105, 20, 55);
  }
  if (p.hair && p.longHair) {
    g.fillStyle = p.hair;
    g.fillRect(28, 40, 64, 70);
  }
  g.fillStyle = p.skin;
  g.fillRect(52, 85, 16, 22);
  if (p.hair) ellipse(60, 45, 30, 26, p.hair);
  ellipse(60, 62, 24, 30, p.skin);
  if (p.beard) {
    g.fillStyle = p.beard;
    g.beginPath();
    g.ellipse(60, 78, 23, 16, 0, 0, Math.PI);
    g.fill();
    g.fillRect(37, 70, 46, 9);
  }
  if (p.glasses === 'dark') {
    g.fillStyle = '#111111';
    g.fillRect(40, 50, 17, 9);
    g.fillRect(63, 50, 17, 9);
    g.fillRect(57, 53, 6, 2);
  } else if (p.glasses === 'frames') {
    g.strokeStyle = '#111111';
    g.lineWidth = 3;
    g.strokeRect(40, 49, 17, 11);
    g.strokeRect(63, 49, 17, 11);
    g.fillStyle = '#111111';
    g.fillRect(57, 53, 6, 2);
    g.fillRect(45, 53, 5, 3);
    g.fillRect(70, 53, 5, 3);
  }
  return g.getImageData(0, 0, 120, 160);
}

function hexDistance(a: string, b: string): number {
  const n = (h: string, i: number): number => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return Math.hypot(n(a, 0) - n(b, 0), n(a, 1) - n(b, 1), n(a, 2) - n(b, 2));
}

describe('photo analysis', () => {
  it('recognizes a range of skin tones', () => {
    for (const hex of ['#ffdbac', '#e0ac69', '#c68642', '#8d5524']) {
      const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
      expect(isSkin(v)).withContext(hex).toBeTrue();
    }
    expect(isSkin([127, 179, 224])).toBeFalse();
  });

  it('reads skin, short hair, a full beard and a red shirt', () => {
    const guess = analyzePhoto(portrait({ skin: '#e0ac69', hair: '#3b2414', beard: '#3b2414', shirt: '#c0392b' }))!;
    expect(hexDistance(guess.appearance.skinColor!, '#e0ac69')).toBeLessThan(30);
    expect(hexDistance(guess.appearance.hairColor!, '#3b2414')).toBeLessThan(40);
    expect(guess.appearance.hairStyle).toBe('short');
    expect(guess.appearance.beardStyle).toBe('full');
    expect(guess.appearance.accessory).toBe('none');
    expect(hexDistance(guess.appearance.outfitColor!, '#c0392b')).toBeLessThan(40);
  });

  it('spots a bald head, glasses and a suit', () => {
    const guess = analyzePhoto(portrait({ skin: '#c68642', glasses: 'frames', shirt: '#f4f4f4', jacket: '#2b2f3a' }))!;
    expect(guess.appearance.hairStyle).toBe('bald');
    expect(guess.appearance.beardStyle).toBe('none');
    expect(guess.appearance.accessory).toBe('glasses');
    expect(guess.appearance.outfitStyle).toBe('suit');
  });

  it('finds glasses under hair and above a beard', () => {
    const guess = analyzePhoto(portrait({ skin: '#8d5524', hair: '#1a1a1a', beard: '#1a1a1a', glasses: 'frames', shirt: '#f4f4f4', jacket: '#26324a' }))!;
    expect(guess.appearance.accessory).toBe('glasses');
    expect(guess.appearance.beardStyle).toBe('full');
  });

  it('does not mistake a beard for glasses', () => {
    const guess = analyzePhoto(portrait({ skin: '#8d5524', hair: '#1a1a1a', beard: '#1a1a1a', shirt: '#c0392b' }))!;
    expect(guess.appearance.accessory).toBe('none');
  });

  it('tells sunglasses apart from glasses', () => {
    const guess = analyzePhoto(portrait({ skin: '#e0ac69', hair: '#111111', glasses: 'dark', shirt: '#2a6fdb' }))!;
    expect(guess.appearance.accessory).toBe('sunglasses');
  });

  it('spots long hair', () => {
    const guess = analyzePhoto(portrait({ skin: '#ffdbac', hair: '#a33a1c', longHair: true, shirt: '#2e8b57' }))!;
    expect(guess.appearance.hairStyle).toBe('long');
  });

  it('returns null when there is no face', () => {
    const c = document.createElement('canvas');
    c.width = 80;
    c.height = 80;
    const g = c.getContext('2d')!;
    g.fillStyle = '#2a6fdb';
    g.fillRect(0, 0, 80, 80);
    expect(analyzePhoto(g.getImageData(0, 0, 80, 80))).toBeNull();
  });
});
