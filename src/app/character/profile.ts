import { Accessory, Appearance, BeardStyle, BodyType, HairStyle, OutfitStyle, shapeValue } from './character.model';
import { FLAT, Material, Pixel, SPRITE_HEIGHT, SPRITE_WIDTH, adjust, palette } from './sprite';

/**
 * The fighter seen from the side, facing right, as fighting games show their fighters.
 * Every pixel belongs to a body part, so the animation can bend arms at the elbow,
 * legs at the knee, and turn head and body. The far arm and leg are drawn darker.
 */
export type BodyPart = 'head' | 'body' | 'armBack' | 'foreBack' | 'armFront' | 'foreFront' | 'legBack' | 'shinBack' | 'legFront' | 'shinFront';

export interface PartPixel extends Pixel {
  part: BodyPart;
}

/** Where the parts turn, in sprite pixels: neck, shoulders, elbows, hips and knees. */
export const JOINTS = {
  neck: [16.5, 15.5],
  shoulder: [16.5, 20],
  elbow: [16.5, 26],
  hipBack: [15.5, 33],
  hipFront: [16.5, 33],
  knee: 39,
} as const;

type Layer = 'back' | 'front';

const PARTS: BodyPart[] = ['armBack', 'foreBack', 'legBack', 'shinBack', 'legFront', 'shinFront', 'body', 'head', 'armFront', 'foreFront'];

/** One pixel grid per body part, so parts hidden behind others are still complete when they move. */
class PartCanvas {
  readonly grids = Object.fromEntries(
    PARTS.map((part) => [part, Array.from({ length: SPRITE_HEIGHT }, () => Array<Material | null>(SPRITE_WIDTH).fill(null))]),
  ) as Record<BodyPart, (Material | null)[][]>;
  part: BodyPart = 'body';

  set(x: number, y: number, m: Material): void {
    if (x < 0 || y < 0 || x >= SPRITE_WIDTH || y >= SPRITE_HEIGHT) return;
    this.grids[this.part][y][x] = m;
  }

  clear(x: number, y: number): void {
    if (this.grids[this.part][y]?.[x] !== undefined) this.grids[this.part][y][x] = null;
  }

  /** Recolors a pixel of the current part that is already painted. */
  paint(x: number, y: number, m: Material): void {
    if (this.get(x, y) !== null) this.grids[this.part][y][x] = m;
  }

  rect(x: number, y: number, w: number, h: number, m: Material): void {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.set(x + dx, y + dy, m);
  }

  rows(y: number, rows: [number, number][], m: Material): void {
    rows.forEach(([from, to], i) => this.rect(from, y + i, to - from + 1, 1, m));
  }

  get(x: number, y: number, part: BodyPart = this.part): Material | null {
    return this.grids[part][y]?.[x] ?? null;
  }
}

/** What an outfit puts on each body region. */
interface Clothes {
  torso: Material;
  upperArm: Material;
  forearm: Material;
  /** Cuff at the end of the sleeve, if any. */
  cuff?: Material;
  thigh: Material;
  shin: Material;
  shoe: Material;
  belt?: Material;
}

const CLOTHES: Record<OutfitStyle, Clothes> = {
  shirt: { torso: 'main', upperArm: 'main', forearm: 'skin', cuff: 'mainDark', thigh: 'pants', shin: 'pants', shoe: 'boots', belt: 'belt' },
  suit: { torso: 'main', upperArm: 'main', forearm: 'main', cuff: 'shirt', thigh: 'main', shin: 'main', shoe: 'boots' },
  casual: { torso: 'main', upperArm: 'main', forearm: 'main', cuff: 'mainDark', thigh: 'pants', shin: 'pants', shoe: 'boots', belt: 'shirt' },
  blouse: { torso: 'main', upperArm: 'main', forearm: 'skin', thigh: 'skin', shin: 'skin', shoe: 'boots', belt: 'belt' },
  uniform: { torso: 'main', upperArm: 'main', forearm: 'main', cuff: 'gold', thigh: 'main', shin: 'boots', shoe: 'boots', belt: 'belt' },
  gi: { torso: 'main', upperArm: 'main', forearm: 'skin', cuff: 'main', thigh: 'main', shin: 'main', shoe: 'skin', belt: 'belt' },
  tanktop: { torso: 'main', upperArm: 'skin', forearm: 'skin', thigh: 'pants', shin: 'pants', shoe: 'boots', belt: 'belt' },
  jacket: { torso: 'main', upperArm: 'main', forearm: 'main', cuff: 'mainDark', thigh: 'pants', shin: 'pants', shoe: 'boots', belt: 'belt' },
  hoodie: { torso: 'main', upperArm: 'main', forearm: 'main', cuff: 'mainDark', thigh: 'pants', shin: 'pants', shoe: 'boots' },
  ninja: { torso: 'main', upperArm: 'main', forearm: 'mainDark', thigh: 'main', shin: 'mainDark', shoe: 'mainDark', belt: 'accent' },
  wrestler: { torso: 'skin', upperArm: 'skin', forearm: 'skin', cuff: 'accent', thigh: 'skin', shin: 'accent', shoe: 'accent', belt: 'belt' },
  armor: { torso: 'metal', upperArm: 'mainDark', forearm: 'metal', thigh: 'pants', shin: 'metal', shoe: 'metal', belt: 'belt' },
};

/** Torso outline per row: how far back and forward of the center the body reaches. */
function torsoRows(body: BodyType): [number, number][] {
  const rows: [number, number][] = [];
  for (let y = 18; y <= 33; y++) {
    let back = y === 18 ? 13 : 12;
    let front = y === 18 ? 19 : 20;
    if (body === 'heavy' && y >= 20) {
      back -= 1;
      // A belly that sticks out in front.
      front += y >= 23 && y <= 30 ? 3 : y >= 21 && y <= 31 ? 2 : 1;
    } else if (body === 'slim' && y >= 19) {
      back += 1;
      front -= 1;
    }
    rows.push([back, front]);
  }
  return rows;
}

function drawHeadShape(c: PartCanvas): void {
  c.part = 'head';
  c.rows(3, [[13, 19], [12, 20], [12, 21], [12, 21], [12, 21], [12, 21], [12, 21], [12, 21], [12, 21], [12, 21], [13, 21], [14, 20], [15, 19]], 'skin');
  // Nose, eye, brow, ear and mouth, all on the side facing right.
  c.rect(22, 9, 1, 2, 'skin');
  c.set(19, 8, 'eyeWhite');
  c.set(20, 8, 'iris');
  c.rect(19, 7, 2, 1, 'hair');
  c.rect(15, 8, 2, 3, 'skinDark');
  c.set(16, 9, 'skin');
  c.rect(20, 13, 2, 1, 'mouth');
}

/** Chin, nose, eye and mouth sliders, applied to the bare head. */
function shapeFace(c: PartCanvas, look: Appearance): void {
  c.part = 'head';
  const chin = shapeValue(look, 'chin');
  if (chin >= 1) c.set(22, 13, 'skin');
  if (chin >= 2) c.rect(20, 14, 2, 1, 'skin');
  if (chin >= 3) c.rect(16, 16, 4, 1, 'skin');
  if (chin <= -1) c.clear(20, 14);
  if (chin <= -2) for (let x = 15; x <= 19; x++) c.clear(x, 15);
  if (chin <= -3) c.clear(21, 13);

  const nose = shapeValue(look, 'nose');
  if (nose <= -1) c.clear(22, 9);
  if (nose <= -2) c.clear(22, 10);
  if (nose >= 1) c.set(23, 10, 'skin');
  if (nose >= 2) {
    c.set(23, 9, 'skin');
    c.set(22, 11, 'skin');
  }
  if (nose >= 3) {
    c.set(24, 10, 'skin');
    c.set(23, 11, 'skin');
  }

  const eyes = shapeValue(look, 'eyes');
  if (eyes <= -2) c.set(19, 8, 'skin');
  if (eyes <= -3) c.set(20, 8, 'hair');
  if (eyes >= 1) c.set(19, 9, 'eyeWhite');
  if (eyes >= 2) c.set(20, 9, 'iris');
  if (eyes >= 3) {
    // Big eyes push the brow up.
    c.set(18, 8, 'eyeWhite');
    c.rect(19, 7, 2, 1, 'skin');
    c.rect(18, 6, 3, 1, 'hair');
  }

  const mouth = shapeValue(look, 'mouth');
  c.rect(20, 13, 2, 1, 'skin');
  const width = Math.max(1, Math.min(4, 2 + Math.round(mouth / 1.5)));
  c.rect(22 - width, 13, width, 1, 'mouth');
  // Wide mouths smile at the corner, small ones turn down.
  if (mouth >= 2) c.set(21 - width, 12, 'mouth');
  if (mouth <= -2) c.set(21 - width, 14, 'mouth');
}

/** Longer or shorter hair at the back of the head, and a longer or shorter beard. */
function shapeHair(c: PartCanvas, look: Appearance): void {
  c.part = 'head';
  const stretch = (inRegion: (x: number, y: number) => boolean, amount: number, keepAbove: number): void => {
    for (let x = 0; x < SPRITE_WIDTH; x++) {
      let bottom = -1;
      for (let y = 0; y < SPRITE_HEIGHT; y++) if (c.get(x, y) === 'hair' && inRegion(x, y)) bottom = y;
      if (bottom < 0) continue;
      if (amount > 0) for (let i = 1; i <= amount; i++) c.set(x, bottom + i, 'hair');
      else for (let i = 0; i < -amount && bottom - i > keepAbove; i++) c.clear(x, bottom - i);
    }
  };
  if (look.hairStyle !== 'bald' && look.hairStyle !== 'mohawk') stretch((x, y) => x <= 14 && y >= 6, shapeValue(look, 'hair') * 2, 8);
  if (look.beardStyle !== 'none' && look.beardStyle !== 'stubble') stretch((x, y) => x >= 15 && y >= 13, shapeValue(look, 'beard') * 2, 13);
}

function drawTorso(c: PartCanvas, look: Appearance, clothes: Clothes): void {
  c.part = 'body';
  c.rect(15, 15, 4, 3, 'skin');
  torsoRows(look.bodyType ?? 'normal').forEach(([from, to], i) => c.rect(from, 18 + i, to - from + 1, 1, i >= 13 ? clothes.thigh === 'skin' ? 'pants' : clothes.thigh : clothes.torso));
  if (clothes.belt) for (let x = 11; x <= 23; x++) c.paint(x, 31, clothes.belt);
}

/** One arm: upper arm from the shoulder, forearm and fist from the elbow. */
function drawArm(c: PartCanvas, layer: Layer, clothes: Clothes, look: Appearance): void {
  const wide = look.bodyType === 'heavy' ? 1 : 0;
  c.part = layer === 'back' ? 'armBack' : 'armFront';
  c.rows(19, [[15, 18], [14, 18], [14, 18 + wide], [14, 18 + wide], [15, 18 + wide], [15, 18], [15, 18]], clothes.upperArm);
  c.part = layer === 'back' ? 'foreBack' : 'foreFront';
  c.rect(15, 26, 4, 5, clothes.forearm);
  if (clothes.cuff) c.rect(15, 30, 4, 1, clothes.cuff);
  c.rows(31, [[15, 18], [15, 19], [15, 18]], 'skin');
  c.set(18, 32, 'skinDark');
}

/** One leg: thigh from the hip, shin and shoe from the knee; shoes point forward. */
function drawLeg(c: PartCanvas, layer: Layer, clothes: Clothes): void {
  c.part = layer === 'back' ? 'legBack' : 'legFront';
  c.rect(14, 33, 5, 6, clothes.thigh);
  c.part = layer === 'back' ? 'shinBack' : 'shinFront';
  c.rect(14, 39, 5, 5, clothes.shin);
  c.rows(44, [[14, 20], [14, 21]], clothes.shoe);
}

/** Collars, ties, pockets and the other bits that make each outfit recognisable. */
function drawOutfitDetails(c: PartCanvas, style: OutfitStyle, look: Appearance): void {
  const front = torsoRows(look.bodyType ?? 'normal').map(([, to]) => to);
  const edge = (y: number): number => front[y - 18];
  c.part = 'body';
  switch (style) {
    case 'shirt':
      c.rect(18, 17, 2, 2, 'mainDark');
      for (let y = 19; y <= 27; y++) c.paint(edge(y), y, 'tie');
      c.paint(edge(31), 31, 'buckle');
      return;
    case 'suit':
      for (let y = 18; y <= 25; y++) c.paint(edge(y), y, y < 25 ? 'tie' : 'shirt');
      for (let y = 18; y <= 23; y++) c.paint(edge(y) - 1, y, 'shirt');
      for (let y = 18; y <= 24; y++) c.paint(edge(y) - 2, y, 'mainDark');
      c.paint(edge(28), 28, 'buckle');
      return;
    case 'casual':
      c.rect(18, 17, 2, 1, 'shirt');
      for (let x = 11; x <= 23; x++) {
        c.paint(x, 29, 'mainDark');
        c.paint(x, 30, 'mainDark');
      }
      return;
    case 'blouse':
      c.paint(edge(18), 18, 'skin');
      c.paint(edge(19), 19, 'skin');
      c.paint(edge(18) - 1, 18, 'skin');
      // A skirt over the thighs; the legs below it are bare.
      c.rows(32, [[12, 20], [12, 21], [11, 21], [11, 21], [11, 22], [10, 22], [10, 22]], 'pants');
      return;
    case 'uniform':
      for (let y = 18; y <= 22; y++) c.paint(edge(y), y, y === 18 ? 'shirt' : 'tie');
      c.rect(14, 18, 4, 1, 'gold');
      c.paint(edge(23) - 1, 23, 'gold');
      c.paint(edge(24) - 2, 24, 'accent');
      c.paint(edge(24) - 1, 24, 'tie');
      return;
    case 'gi':
      for (let y = 18; y <= 22; y++) for (let x = edge(y) - (22 - y) / 2; x <= edge(y); x++) c.paint(Math.round(x), y, 'skin');
      c.rect(19, 32, 2, 4, 'belt');
      return;
    case 'tanktop':
      for (let x = 12; x <= 20; x++) c.paint(x, 18, 'skin');
      c.paint(13, 19, 'skin');
      return;
    case 'jacket':
      for (let y = 18; y <= 30; y++) c.paint(edge(y), y, 'accent');
      for (let y = 18; y <= 21; y++) c.paint(edge(y) - 1, y, 'mainDark');
      return;
    case 'hoodie':
      // The hood lies on the neck and back of the head.
      c.rows(13, [[12, 14], [11, 14], [11, 15], [11, 15], [11, 14], [12, 13]], 'mainDark');
      c.rect(edge(26) - 3, 26, 4, 4, 'mainDark');
      c.paint(edge(19), 19, 'accent');
      c.paint(edge(20), 20, 'accent');
      c.paint(edge(21), 21, 'accent');
      return;
    case 'ninja':
      c.part = 'head';
      for (let y = 3; y <= 17; y++) for (let x = 11; x <= 22; x++) if (c.get(x, y) && (y < 7 || y > 9 || x < 17)) c.paint(x, y, 'main');
      for (let x = 12; x <= 21; x++) c.paint(x, 5, 'accent');
      c.rect(9, 5, 3, 2, 'accent');
      c.part = 'body';
      c.rect(15, 15, 4, 3, 'main');
      return;
    case 'wrestler':
      c.rows(18, [[15, 16], [15, 16], [15, 16], [15, 16], [15, 16]], 'main');
      for (let y = 23; y <= 33; y++) for (let x = 10; x <= 24; x++) c.paint(x, y, y >= 31 && y <= 32 ? 'belt' : 'main');
      c.paint(edge(31), 31, 'buckle');
      return;
    case 'armor':
      for (let y = 20; y <= 30; y++) for (let x = edge(y) - 3; x <= edge(y) - 1; x++) c.paint(x, y, 'main');
      c.paint(edge(23) - 2, 23, 'accent');
      return;
  }
}

/** Sleeve details drawn on the arm parts: epaulettes, pauldrons, wrist bands. */
function drawArmDetails(c: PartCanvas, layer: Layer, style: OutfitStyle): void {
  c.part = layer === 'back' ? 'armBack' : 'armFront';
  if (style === 'armor') c.rows(18, [[13, 19], [13, 19], [13, 19], [14, 18]], 'metal');
  if (style === 'uniform') c.rect(14, 19, 5, 1, 'gold');
  if (style === 'shirt' || style === 'blouse') c.rect(15, 25, 4, 1, 'mainDark');
  if (style === 'gi') c.rect(15, 26, 4, 1, 'main');
}

function drawLegDetails(c: PartCanvas, layer: Layer, style: OutfitStyle): void {
  c.part = layer === 'back' ? 'legBack' : 'legFront';
  if (style === 'armor') c.rect(14, 37, 5, 2, 'metal');
  if (style === 'wrestler') c.rect(14, 33, 5, 2, 'main');
}

function drawHair(c: PartCanvas, style: HairStyle): void {
  c.part = 'head';
  const cap = (): void => {
    c.rows(2, [[13, 19], [12, 20], [11, 21], [11, 20], [11, 18], [11, 16]], 'hair');
    c.rows(8, [[11, 14], [11, 14], [12, 14], [12, 13]], 'hair');
  };
  switch (style) {
    case 'short':
      cap();
      c.set(17, 8, 'hair');
      return;
    case 'spiky':
      cap();
      c.rows(0, [[13, 13], [12, 14]], 'hair');
      c.rows(0, [[17, 17], [16, 18]], 'hair');
      c.rows(1, [[21, 21]], 'hair');
      c.rows(2, [[9, 10], [10, 11]], 'hair');
      return;
    case 'long':
      cap();
      c.rows(6, [[10, 14], [10, 14], [9, 14], [9, 14], [9, 13], [9, 13], [9, 13], [9, 13], [10, 13], [10, 13], [10, 13], [10, 12], [10, 12], [11, 12], [11, 12]], 'hair');
      return;
    case 'mohawk':
      c.rows(0, [[14, 19], [12, 20], [11, 20], [11, 13], [11, 12], [11, 12], [11, 12]], 'hair');
      return;
    case 'ponytail':
      cap();
      c.rows(5, [[9, 11], [8, 11], [7, 10], [7, 10], [7, 9], [7, 9], [8, 9], [8, 9]], 'hair');
      c.set(11, 5, 'mainDark');
      return;
    case 'afro':
      c.rows(0, [[12, 19], [10, 21], [9, 22], [8, 22], [8, 21], [8, 18], [8, 17], [8, 15], [8, 15], [8, 15], [9, 14], [10, 13]], 'hair');
      return;
    case 'receding':
      c.rows(5, [[12, 14], [11, 14], [11, 14], [11, 14], [12, 13]], 'hair');
      c.rect(19, 5, 2, 1, 'skinDark');
      c.set(19, 12, 'skinDark');
      return;
    case 'bald':
      c.set(13, 5, 'skinDark');
      return;
  }
}

function drawBeard(c: PartCanvas, style: BeardStyle): void {
  c.part = 'head';
  const mustache = (): void => c.rect(19, 12, 3, 1, 'hair');
  switch (style) {
    case 'none':
      return;
    case 'stubble':
      for (let y = 10; y <= 15; y++) for (let x = 15; x <= 21; x++) if ((x + y) % 2 === 0 && c.get(x, y) === 'skin') c.set(x, y, 'hair');
      return;
    case 'mustache':
      mustache();
      c.set(19, 13, 'hair');
      return;
    case 'goatee':
      mustache();
      c.rows(14, [[19, 20], [18, 20]], 'hair');
      return;
    case 'full':
      mustache();
      c.rows(10, [[15, 16], [15, 17], [15, 19], [15, 19], [15, 21], [15, 20], [16, 19]], 'hair');
      c.rect(20, 13, 2, 1, 'mouth');
      return;
    case 'long':
      mustache();
      c.rows(10, [[15, 16], [15, 17], [15, 19], [15, 19], [15, 21], [15, 21], [16, 21], [17, 21], [17, 21], [18, 21], [18, 21], [19, 20], [19, 20]], 'hair');
      c.rect(20, 13, 2, 1, 'mouth');
      return;
  }
}

function drawAccessory(c: PartCanvas, accessory: Accessory): void {
  c.part = 'head';
  switch (accessory) {
    case 'none':
      return;
    case 'glasses':
      c.rows(7, [[18, 21], [18, 18], [18, 21]], 'rim');
      c.set(21, 8, 'rim');
      c.rect(15, 7, 3, 1, 'rim');
      return;
    case 'sunglasses':
      c.rect(15, 7, 7, 1, 'frame');
      c.rect(19, 8, 3, 2, 'lens');
      c.set(20, 8, 'shirt');
      return;
    case 'headset':
      c.rows(1, [[13, 17], [12, 13]], 'frame');
      c.rect(12, 3, 1, 4, 'frame');
      c.rect(14, 7, 3, 4, 'frame');
      c.rect(17, 11, 3, 1, 'frame');
      c.set(20, 11, 'gold');
      return;
    case 'cap':
      c.rows(0, [[13, 19], [12, 20], [11, 21], [11, 21], [11, 21]], 'mainDark');
      c.rect(19, 5, 6, 1, 'frame');
      c.rect(11, 5, 8, 1, 'frame');
      c.set(17, 2, 'gold');
      return;
  }
}

function paintProfile(look: Appearance): PartCanvas {
  const c = new PartCanvas();
  const clothes = CLOTHES[look.outfitStyle] ?? CLOTHES.casual;
  drawArm(c, 'back', clothes, look);
  drawArmDetails(c, 'back', look.outfitStyle);
  drawLeg(c, 'back', clothes);
  drawLegDetails(c, 'back', look.outfitStyle);
  drawLeg(c, 'front', clothes);
  drawLegDetails(c, 'front', look.outfitStyle);
  drawTorso(c, look, clothes);
  drawHeadShape(c);
  shapeFace(c, look);
  if (look.bodyType === 'slim' && look.outfitStyle !== 'ninja') c.set(20, 7, 'lash');
  drawHair(c, look.hairStyle);
  drawBeard(c, look.beardStyle);
  shapeHair(c, look);
  drawOutfitDetails(c, look.outfitStyle, look);
  if (look.outfitStyle !== 'ninja') drawAccessory(c, look.accessory ?? 'none');
  drawArm(c, 'front', clothes, look);
  drawArmDetails(c, 'front', look.outfitStyle);
  return c;
}

/**
 * The side view without outline, each pixel labelled with its part and lit like the
 * front sprite. Far limbs are a little darker, so the near ones stand out.
 */
export function profileParts(look: Appearance): PartPixel[] {
  const c = paintProfile(look);
  const colors = palette(look);
  const pixels: PartPixel[] = [];
  for (const part of PARTS) {
    const far = part === 'armBack' || part === 'foreBack' || part === 'legBack' || part === 'shinBack';
    for (let y = 0; y < SPRITE_HEIGHT; y++) {
      for (let x = 0; x < SPRITE_WIDTH; x++) {
        const m = c.get(x, y, part);
        if (m === null) continue;
        let fill = colors[m];
        if (!FLAT.has(m)) {
          if (c.get(x, y - 1, part) !== m) fill = adjust(fill, 0.18);
          else if (c.get(x - 1, y, part) !== m || c.get(x, y + 1, part) !== m) fill = adjust(fill, -0.25);
        }
        if (far) fill = adjust(fill, -0.3);
        pixels.push({ x, y, fill, part });
      }
    }
  }
  return pixels;
}
