import { Appearance, BeardStyle, HairStyle, OutfitStyle } from './character.model';

/**
 * Guesses a character's look from a portrait photo, entirely in the browser.
 * It uses simple color rules rather than a face model, so it gives a starting
 * point that the player then fine-tunes in the editor.
 */

export interface PixelImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface PhotoGuess {
  appearance: Partial<Appearance>;
  /** What was recognized, in words for the player. */
  notes: string[];
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

type Rgb = [number, number, number];

export function analyzePhoto(img: PixelImage): PhotoGuess | null {
  const { width: w, height: h } = img;
  const px = (x: number, y: number): Rgb => {
    const i = (y * w + x) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  };

  const background = borderAverage(img, px);
  const isBackground = (c: Rgb): boolean => distance(c, background) < 45;

  const skinMask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isSkin(px(x, y)) && !isBackground(px(x, y))) skinMask[y * w + x] = 1;

  const face = faceRegion(skinMask, w, h);
  if (!face || face.size < w * h * 0.02) return null;
  const fw = face.box.right - face.box.left + 1;
  // Faces are about 1.25 times as tall as wide. Neck skin can make the patch taller and a
  // beard can make it shorter, so the height comes from the width instead.
  const box: Box = { ...face.box, bottom: Math.min(h - 1, face.box.top + Math.round(fw * 1.25)) };
  const fh = box.bottom - box.top + 1;
  const cx = Math.round((box.left + box.right) / 2);

  const region = (x0: number, y0: number, x1: number, y1: number): Rgb[] => {
    const out: Rgb[] = [];
    for (let y = Math.max(0, Math.round(y0)); y <= Math.min(h - 1, Math.round(y1)); y++) {
      for (let x = Math.max(0, Math.round(x0)); x <= Math.min(w - 1, Math.round(x1)); x++) out.push(px(x, y));
    }
    return out;
  };
  const notes: string[] = [];
  const appearance: Partial<Appearance> = {};

  // Skin: the middle band of the face, away from hair and beard.
  const skinSamples = region(box.left + fw * 0.2, box.top + fh * 0.3, box.right - fw * 0.2, box.top + fh * 0.6).filter(isSkin);
  const skin = average(skinSamples.length ? skinSamples : region(box.left, box.top, box.right, box.bottom).filter(isSkin));
  appearance.skinColor = toHex(skin);
  const skinLuma = luma(skin);
  const notSkin = (c: Rgb): boolean => !isSkin(c) && !isBackground(c) && distance(c, skin) > 50;

  // Hair: above and around the top of the face.
  const hairArea = region(box.left - fw * 0.2, box.top - fh * 0.5, box.right + fw * 0.2, box.top + fh * 0.12);
  const hairPixels = hairArea.filter(notSkin);
  const hairFraction = hairPixels.length / Math.max(1, hairArea.length);
  const hair = hairPixels.length ? average(hairPixels) : skin;
  let hairStyle: HairStyle = 'short';
  if (hairFraction < 0.1) hairStyle = 'bald';
  else if (hairFraction < 0.22) hairStyle = 'receding';
  else {
    const isHair = (c: Rgb): boolean => distance(c, hair) < 70 && !isSkin(c);
    const sides = [
      ...region(box.left - fw * 0.35, box.top + fh * 0.35, box.left - 1, box.bottom + fh * 0.3),
      ...region(box.right + 1, box.top + fh * 0.35, box.right + fw * 0.35, box.bottom + fh * 0.3),
    ];
    const sideHair = sides.filter(isHair).length / Math.max(1, sides.length);
    const crown = region(box.left - fw * 0.4, box.top - fh * 0.5, box.right + fw * 0.4, box.top - fh * 0.3);
    const crownHair = crown.filter(isHair).length / Math.max(1, crown.length);
    if (sideHair > 0.35) hairStyle = 'long';
    else if (crownHair > 0.55) hairStyle = 'afro';
  }
  appearance.hairStyle = hairStyle;
  if (hairStyle !== 'bald') appearance.hairColor = toHex(hair);
  notes.push(`Frisur: ${HAIR_WORDS[hairStyle]}`);

  // Beard: lower face and chin, dark pixels that are clearly not skin.
  const darkNotSkin = (c: Rgb): boolean => !isSkin(c) && luma(c) < skinLuma * 0.8;
  const chin = region(box.left + fw * 0.2, box.top + fh * 0.72, box.right - fw * 0.2, box.bottom + fh * 0.08);
  const lip = region(cx - fw * 0.18, box.top + fh * 0.62, cx + fw * 0.18, box.top + fh * 0.7);
  const chinDark = chin.filter(darkNotSkin).length / Math.max(1, chin.length);
  const lipDark = lip.filter(darkNotSkin).length / Math.max(1, lip.length);
  let beardStyle: BeardStyle = 'none';
  if (chinDark > 0.5) beardStyle = 'full';
  else if (chinDark > 0.3) beardStyle = 'goatee';
  else if (chinDark > 0.15) beardStyle = 'stubble';
  else if (lipDark > 0.45) beardStyle = 'mustache';
  appearance.beardStyle = beardStyle;
  if (beardStyle !== 'none') {
    notes.push(`Bart: ${BEARD_WORDS[beardStyle]}`);
    if (hairStyle === 'bald') appearance.hairColor = toHex(average(chin.filter(darkNotSkin)));
  }

  // Glasses: a dark band across the eyes means sunglasses; a dark bridge over the nose,
  // where bare faces only have skin, means a frame. Hair over the forehead moves the eyes
  // closer to the top of the skin patch, so the eye band is searched rather than fixed.
  const dark = (c: Rgb): boolean => luma(c) < Math.min(70, skinLuma * 0.45);
  const share = (pixels: Rgb[]): number => pixels.filter(dark).length / Math.max(1, pixels.length);
  const band = fh * 0.16;
  let eyesDark = 0;
  let bridgeDark = 0;
  for (let y = box.top + fh * 0.1; y <= box.top + fh * 0.32; y++) {
    eyesDark = Math.max(eyesDark, share(region(box.left + fw * 0.1, y, box.right - fw * 0.1, y + band)));
    bridgeDark = Math.max(bridgeDark, share(region(cx - fw * 0.06, y, cx + fw * 0.06, y + band)));
  }
  if (eyesDark > 0.5) {
    appearance.accessory = 'sunglasses';
    notes.push('Sonnenbrille erkannt');
  } else if (eyesDark > 0.22 || bridgeDark > 0.12) {
    appearance.accessory = 'glasses';
    notes.push('Brille erkannt');
  } else {
    appearance.accessory = 'none';
  }

  // Clothing: below the face, the most common color wins.
  const top = box.bottom + fh * 0.45;
  const clothes = region(cx - fw, top, cx + fw, top + fh * 0.8).filter((c) => !isBackground(c) && !isSkin(c));
  if (clothes.length > 20) {
    const main = dominant(clothes);
    appearance.outfitColor = toHex(main);
    const center = average(region(cx - fw * 0.1, top, cx + fw * 0.1, top + fh * 0.6));
    const sides = average([...region(cx - fw * 0.8, top, cx - fw * 0.4, top + fh * 0.6), ...region(cx + fw * 0.4, top, cx + fw * 0.8, top + fh * 0.6)]);
    let outfit: OutfitStyle = 'casual';
    if (luma(center) - luma(sides) > 60 && luma(sides) < 110) {
      outfit = 'suit';
      appearance.outfitColor = toHex(sides);
    } else if (luma(main) > 150) outfit = 'shirt';
    appearance.outfitStyle = outfit;
    notes.push(`Kleidung: ${OUTFIT_WORDS[outfit]}`);
  }

  return { appearance, notes };
}

const HAIR_WORDS: Partial<Record<HairStyle, string>> = {
  short: 'kurz',
  long: 'lang',
  afro: 'Afro',
  receding: 'Halbglatze',
  bald: 'Glatze',
};

const BEARD_WORDS: Partial<Record<BeardStyle, string>> = {
  stubble: 'Dreitagebart',
  mustache: 'Schnurrbart',
  goatee: 'Ziegenbart',
  full: 'Vollbart',
};

const OUTFIT_WORDS: Partial<Record<OutfitStyle, string>> = {
  suit: 'Anzug',
  shirt: 'Hemd',
  casual: 'Business Casual',
};

/** Skin detection in YCbCr space, which works across a wide range of skin tones. */
export function isSkin([r, g, b]: Rgb): boolean {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return y > 45 && cb >= 77 && cb <= 127 && cr >= 135 && cr <= 180;
}

function luma([r, g, b]: Rgb): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function distance(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function average(colors: Rgb[]): Rgb {
  if (colors.length === 0) return [128, 128, 128];
  const sum = colors.reduce((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]], [0, 0, 0]);
  return [sum[0] / colors.length, sum[1] / colors.length, sum[2] / colors.length];
}

/** Average of the most common color bucket. */
function dominant(colors: Rgb[]): Rgb {
  const buckets = new Map<number, Rgb[]>();
  for (const c of colors) {
    const key = ((c[0] >> 5) << 6) | ((c[1] >> 5) << 3) | (c[2] >> 5);
    const list = buckets.get(key);
    if (list) list.push(c);
    else buckets.set(key, [c]);
  }
  let best: Rgb[] = [];
  for (const list of buckets.values()) if (list.length > best.length) best = list;
  return average(best);
}

function toHex(c: Rgb): string {
  return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function borderAverage(img: PixelImage, px: (x: number, y: number) => Rgb): Rgb {
  const samples: Rgb[] = [];
  const m = Math.max(1, Math.round(Math.min(img.width, img.height) * 0.04));
  for (let x = 0; x < img.width; x += 2) {
    for (let d = 0; d < m; d++) samples.push(px(x, d));
  }
  for (let y = 0; y < img.height * 0.6; y += 2) {
    for (let d = 0; d < m; d++) {
      samples.push(px(d, Math.floor(y)));
      samples.push(px(img.width - 1 - d, Math.floor(y)));
    }
  }
  return dominant(samples);
}

interface Component {
  box: Box;
  size: number;
  score: number;
}

/**
 * The biggest connected patch of skin, favoring the upper part of the photo where faces
 * usually are. Glasses, beards or shadows can split a face into pieces, so patches
 * directly above or below it are merged in.
 */
function faceRegion(mask: Uint8Array, w: number, h: number): { box: Box; size: number } | null {
  const parts = components(mask, w, h).filter((c) => c.size >= 4);
  if (parts.length === 0) return null;
  const best = parts.reduce((a, b) => (b.score > a.score ? b : a));
  const box = { ...best.box };
  let size = best.size;
  let merged = true;
  while (merged) {
    merged = false;
    const width = box.right - box.left + 1;
    for (const part of parts) {
      if (part.size === 0) continue;
      const overlap = Math.min(box.right, part.box.right) - Math.max(box.left, part.box.left) + 1;
      const gap = Math.max(part.box.top - box.bottom, box.top - part.box.bottom);
      const partWidth = part.box.right - part.box.left + 1;
      const inside = part.box.left >= box.left && part.box.right <= box.right && part.box.top >= box.top && part.box.bottom <= box.bottom;
      if (part === best || (!inside && (overlap < Math.min(width, partWidth) * 0.5 || gap > width * 0.25))) continue;
      box.left = Math.min(box.left, part.box.left);
      box.right = Math.max(box.right, part.box.right);
      box.top = Math.min(box.top, part.box.top);
      box.bottom = Math.max(box.bottom, part.box.bottom);
      size += part.size;
      part.size = 0;
      merged = true;
    }
  }
  return { box, size };
}

function components(mask: Uint8Array, w: number, h: number): Component[] {
  const seen = new Uint8Array(w * h);
  const found: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const box: Box = { left: w, top: h, right: 0, bottom: 0 };
    let size = 0;
    let sumY = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      size++;
      sumY += y;
      box.left = Math.min(box.left, x);
      box.right = Math.max(box.right, x);
      box.top = Math.min(box.top, y);
      box.bottom = Math.max(box.bottom, y);
      for (const n of [i - 1, i + 1, i - w, i + w]) {
        if (n < 0 || n >= mask.length || seen[n] || !mask[n]) continue;
        if ((n === i - 1 && x === 0) || (n === i + 1 && x === w - 1)) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    found.push({ box, size, score: size * (1.5 - sumY / size / h) });
  }
  return found;
}
