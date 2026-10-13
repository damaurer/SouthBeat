import { Painter } from '../arena/painter';
import {
  ARENA_WIDTH,
  FLOOR_Y,
  FloorKind,
  bookshelf,
  ceilingLamp,
  cityWindow,
  coffeeMachine,
  desk,
  floor,
  monitor,
  neon,
  officeChair,
  pizzaBoxes,
  plant,
  serverRack,
  sign,
  stringLights,
  tomatoPlanter,
  wall,
  whiteboard,
} from '../arena/props';

/**
 * An arena described as data instead of drawing code: a wall, a floor and a list of props
 * from the arena building kit. Content packs and the content studio use this format.
 * The picture is 240×135 pixels; the back wall ends at y=100, below is the floor.
 */
export interface ArenaSpec {
  id: string;
  name: string;
  description: string;
  wall: string;
  floor: { color: string; kind: FloorKind };
  /** Optional ceiling strip, e.g. '#2e3136'. */
  ceiling?: string;
  props: ArenaProp[];
}

export type Sky = 'day' | 'sunset' | 'night';

export type ArenaProp =
  | { type: 'window'; x: number; y: number; w: number; h: number; sky: Sky }
  | { type: 'lamp'; x: number; y: number; w: number }
  | { type: 'desk'; x: number; w: number; color: string; monitors: number }
  | { type: 'chair'; x: number; color: string }
  | { type: 'plant'; x: number; pot: string }
  | { type: 'server-rack'; x: number; y: number; w: number; h: number; led: string }
  | { type: 'whiteboard'; x: number; y: number; w: number; h: number; lines: string[] }
  | { type: 'sign'; x: number; y: number; text: string; bg: string; fg: string }
  | { type: 'neon'; x: number; y: number; text: string; color: string }
  | { type: 'bookshelf'; x: number; y: number; w: number; h: number }
  | { type: 'coffee-machine'; x: number }
  | { type: 'pizza-boxes'; x: number; count: number }
  | { type: 'string-lights'; x1: number; x2: number; y: number; sag: number; colors: string[] }
  | { type: 'tomato-planter'; x: number; w: number; height: number }
  | { type: 'monitor'; x: number; y: number; w: number; h: number }
  | { type: 'rect'; x: number; y: number; w: number; h: number; color: string };

export type PropType = ArenaProp['type'];

export const FLOOR_KINDS: readonly FloorKind[] = ['tiles', 'carpet', 'wood', 'concrete', 'raised'];
export const SKIES: readonly Sky[] = ['day', 'sunset', 'night'];

const SKY_BANDS: Record<Sky, string[]> = {
  day: ['#6fb7ff', '#8ec9ff', '#b3dbff'],
  sunset: ['#3b2d6b', '#a8456b', '#f28c38', '#ffd27a'],
  night: ['#0b0f2a', '#141a3d', '#1f2752'],
};

/**
 * Every prop with its fields: [name, kind, min, max]. Positions are pixels; 'color' fields
 * are #rrggbb. Used for checking, for the JSON schema and for the LLM's instructions.
 */
type Field = [string, 'int' | 'color' | 'text' | 'sky' | 'lines' | 'colors', number, number];
const X: Field = ['x', 'int', 0, ARENA_WIDTH - 1];
const Y: Field = ['y', 'int', 0, FLOOR_Y - 1];
export const PROP_FIELDS: Record<PropType, Field[]> = {
  window: [X, Y, ['w', 'int', 8, 120], ['h', 'int', 8, 70], ['sky', 'sky', 0, 0]],
  lamp: [X, ['y', 'int', 0, 30], ['w', 'int', 6, 60]],
  desk: [X, ['w', 'int', 24, 90], ['color', 'color', 0, 0], ['monitors', 'int', 0, 4]],
  chair: [X, ['color', 'color', 0, 0]],
  plant: [X, ['pot', 'color', 0, 0]],
  'server-rack': [X, Y, ['w', 'int', 10, 30], ['h', 'int', 20, 70], ['led', 'color', 0, 0]],
  whiteboard: [X, Y, ['w', 'int', 20, 80], ['h', 'int', 14, 40], ['lines', 'lines', 0, 4]],
  sign: [X, Y, ['text', 'text', 1, 12], ['bg', 'color', 0, 0], ['fg', 'color', 0, 0]],
  neon: [X, Y, ['text', 'text', 1, 12], ['color', 'color', 0, 0]],
  bookshelf: [X, Y, ['w', 'int', 12, 60], ['h', 'int', 20, 70]],
  'coffee-machine': [X],
  'pizza-boxes': [X, ['count', 'int', 1, 8]],
  'string-lights': [['x1', 'int', 0, ARENA_WIDTH - 1], ['x2', 'int', 0, ARENA_WIDTH - 1], ['y', 'int', 0, 60], ['sag', 'int', 0, 20], ['colors', 'colors', 1, 6]],
  'tomato-planter': [X, ['w', 'int', 16, 120], ['height', 'int', 16, 50]],
  monitor: [X, Y, ['w', 'int', 8, 40], ['h', 'int', 6, 30]],
  rect: [X, ['y', 'int', 0, 134], ['w', 'int', 1, ARENA_WIDTH], ['h', 'int', 1, 135], ['color', 'color', 0, 0]],
};

export const MAX_PROPS = 40;
const HEX = /^#[0-9a-f]{6}$/i;
/** The pixel font knows letters A–Z (drawn as capitals), digits and a few signs. */
const SIGN_TEXT = /^[A-Z0-9 .,:!?\-+/()#%&'*<>=_]+$/i;

/** What is wrong with a prop, or nothing. */
export function propErrors(prop: unknown, where: string): string[] {
  const p = prop as Record<string, unknown>;
  if (!p || typeof p !== 'object' || !(String(p['type']) in PROP_FIELDS)) {
    return [`${where}: unbekannter Prop-Typ "${String(p?.['type'])}". Erlaubt: ${Object.keys(PROP_FIELDS).join(', ')}.`];
  }
  const errors: string[] = [];
  for (const [name, kind, min, max] of PROP_FIELDS[p['type'] as PropType]) {
    const v = p[name];
    const bad = (rule: string): number => errors.push(`${where} (${String(p['type'])}): ${name} ${rule}.`);
    if (kind === 'int' && (!Number.isInteger(v) || (v as number) < min || (v as number) > max)) bad(`muss eine ganze Zahl von ${min} bis ${max} sein`);
    if (kind === 'color' && !(typeof v === 'string' && HEX.test(v))) bad('muss eine Farbe wie #a1b2c3 sein');
    if (kind === 'text' && !(typeof v === 'string' && v.length >= min && v.length <= max && SIGN_TEXT.test(v))) bad(`muss ${min} bis ${max} Buchstaben (A–Z) oder Ziffern haben`);
    if (kind === 'sky' && !SKIES.includes(v as Sky)) bad(`muss ${SKIES.join(', ')} sein`);
    if (kind === 'lines' && !(Array.isArray(v) && v.length <= max && v.every((l) => typeof l === 'string' && l.length <= 14 && SIGN_TEXT.test(l)))) bad(`muss eine Liste von höchstens ${max} kurzen Zeilen (A–Z, Ziffern) sein`);
    if (kind === 'colors' && !(Array.isArray(v) && v.length >= min && v.length <= max && v.every((c) => typeof c === 'string' && HEX.test(c)))) bad(`muss eine Liste mit ${min} bis ${max} Farben sein`);
  }
  return errors;
}

export function arenaSpecErrors(spec: ArenaSpec, where = 'Arena'): string[] {
  const errors: string[] = [];
  if (!HEX.test(String(spec.wall))) errors.push(`${where}: wall muss eine Farbe wie #a1b2c3 sein.`);
  if (spec.ceiling !== undefined && !HEX.test(String(spec.ceiling))) errors.push(`${where}: ceiling muss eine Farbe sein.`);
  if (!spec.floor || !HEX.test(String(spec.floor.color)) || !FLOOR_KINDS.includes(spec.floor.kind)) {
    errors.push(`${where}: floor braucht color (#rrggbb) und kind (${FLOOR_KINDS.join(', ')}).`);
  }
  if (!Array.isArray(spec.props) || spec.props.length > MAX_PROPS) errors.push(`${where}: props muss eine Liste mit höchstens ${MAX_PROPS} Einträgen sein.`);
  else spec.props.forEach((p, i) => errors.push(...propErrors(p, `${where} props[${i}]`)));
  return errors;
}

/** Paints an arena from its description; props are drawn in list order, later ones in front. */
export function drawArenaSpec(spec: ArenaSpec, p: Painter): void {
  wall(p, spec.wall);
  if (spec.ceiling) p.rect(0, 0, ARENA_WIDTH, 8, spec.ceiling);
  spec.props.forEach((prop, i) => {
    const seed = i * 7 + 3;
    switch (prop.type) {
      case 'window':
        return cityWindow(p, prop.x, prop.y, prop.w, prop.h, SKY_BANDS[prop.sky], { night: prop.sky === 'night', seed });
      case 'lamp':
        return ceilingLamp(p, prop.x, prop.y, prop.w);
      case 'desk':
        return desk(p, prop.x, 74, prop.w, prop.color, seed, prop.monitors);
      case 'chair':
        return officeChair(p, prop.x, prop.color);
      case 'plant':
        return plant(p, prop.x, FLOOR_Y, prop.pot);
      case 'server-rack':
        return serverRack(p, prop.x, prop.y, prop.w, Math.min(prop.h, FLOOR_Y - prop.y), seed, prop.led);
      case 'whiteboard':
        return whiteboard(p, prop.x, prop.y, prop.w, prop.h, prop.lines);
      case 'sign':
        sign(p, prop.x, prop.y, prop.text, prop.bg, prop.fg);
        return;
      case 'neon':
        return neon(p, prop.x, prop.y, prop.text, prop.color, spec.wall);
      case 'bookshelf':
        return bookshelf(p, prop.x, prop.y, prop.w, Math.min(prop.h, FLOOR_Y - prop.y), seed);
      case 'coffee-machine':
        return coffeeMachine(p, prop.x, FLOOR_Y);
      case 'pizza-boxes':
        return pizzaBoxes(p, prop.x, FLOOR_Y, prop.count);
      case 'string-lights':
        return stringLights(p, Math.min(prop.x1, prop.x2), Math.max(prop.x1, prop.x2), prop.y, prop.sag, prop.colors);
      case 'tomato-planter':
        return tomatoPlanter(p, prop.x, prop.w, FLOOR_Y, prop.height, seed);
      case 'monitor':
        return monitor(p, prop.x, prop.y, prop.w, prop.h, seed);
      case 'rect':
        return p.rect(prop.x, prop.y, prop.w, prop.h, prop.color);
    }
  });
  floor(p, spec.floor.color, spec.floor.kind, spec.id.length);
}
