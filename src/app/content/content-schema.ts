import { ACCESSORIES, BEARD_STYLES, BODY_TYPES, HAIR_STYLES, MOVE_SLOTS, OUTFIT_STYLES, SHAPE_KEYS, SHAPE_MAX, SHAPE_MIN, STAT_KEYS } from '../character/character.model';
import { FLOOR_KINDS, PROP_FIELDS, PropType, SKIES } from './arena-spec';
import { MOVE_LIMITS, OPPONENT_BUDGET } from './content';

type Schema = Record<string, unknown>;

const color: Schema = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' };
const id: Schema = { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{1,39}$' };
const str = (min: number, max: number, description?: string): Schema => ({ type: 'string', minLength: min, maxLength: max, ...(description ? { description } : {}) });
const sentences = (max: number): Schema => ({ type: 'array', maxItems: max, items: str(1, 90) });

function propSchema(type: PropType): Schema {
  const properties: Schema = { type: { const: type } };
  for (const [name, kind, min, max] of PROP_FIELDS[type]) {
    properties[name] =
      kind === 'int'
        ? { type: 'integer', minimum: min, maximum: max }
        : kind === 'color'
          ? color
          : kind === 'sky'
            ? { enum: SKIES }
            : kind === 'text'
              ? { type: 'string', minLength: min, maxLength: max, pattern: "^[A-Za-z0-9 .,:!?\\-+/()#%&'*<>=_]+$" }
              : kind === 'lines'
                ? { type: 'array', maxItems: max, items: { type: 'string', maxLength: 14 } }
                : { type: 'array', minItems: min, maxItems: max, items: color };
  }
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
}

const character: Schema = {
  type: 'object',
  required: ['name', 'appearance', 'moves', 'stats'],
  additionalProperties: false,
  properties: {
    name: str(2, 16),
    appearance: {
      type: 'object',
      additionalProperties: false,
      required: ['bodyType', 'accessory', 'skinColor', 'eyeColor', 'hairColor', 'hairStyle', 'beardStyle', 'outfitColor', 'outfitStyle'],
      properties: {
        bodyType: { enum: BODY_TYPES },
        accessory: { enum: ACCESSORIES },
        skinColor: color,
        eyeColor: color,
        hairColor: color,
        hairStyle: { enum: HAIR_STYLES },
        beardStyle: { enum: BEARD_STYLES },
        outfitColor: color,
        outfitStyle: { enum: OUTFIT_STYLES },
        shape: {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(SHAPE_KEYS.map((k) => [k, { type: 'integer', minimum: SHAPE_MIN, maximum: SHAPE_MAX }])),
        },
      },
    },
    moves: {
      type: 'object',
      additionalProperties: false,
      required: [...MOVE_SLOTS],
      description: 'Move-ids je Slot: eingebaute oder aus diesem Paket.',
      properties: Object.fromEntries(MOVE_SLOTS.map((s) => [s, { type: 'string' }])),
    },
    stats: {
      type: 'object',
      additionalProperties: false,
      required: [...STAT_KEYS],
      description: `Je 1–10. Summe höchstens 22 (fighters) bzw. ${OPPONENT_BUDGET} (opponents).`,
      properties: Object.fromEntries(STAT_KEYS.map((k) => [k, { type: 'integer', minimum: 1, maximum: 10 }])),
    },
  },
};

const range = ([min, max]: readonly [number, number], integer = true): Schema => ({ type: integer ? 'integer' : 'number', minimum: min, maximum: max });

const move: Schema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'slot', 'damage', 'startupFrames'],
  description: 'Ausgewogen: damage × hits − startupFrames/2 muss im erlaubten Bereich des Slots liegen (siehe AGENTS.md).',
  properties: {
    id,
    name: str(2, 30),
    slot: { enum: MOVE_SLOTS },
    damage: { type: 'integer', minimum: 1, maximum: 36 },
    startupFrames: { type: 'integer', minimum: 3, maximum: 30 },
    reach: range(MOVE_LIMITS.reach),
    knockback: range(MOVE_LIMITS.knockback),
    hitstun: range(MOVE_LIMITS.hitstun),
    hits: range(MOVE_LIMITS.hits),
    projectileSpeed: range(MOVE_LIMITS.projectileSpeed, false),
    arc: range(MOVE_LIMITS.arc),
    dashSpeed: range(MOVE_LIMITS.dashSpeed),
    exclusive: { type: 'boolean', description: 'Signatur-Move: nur für Kämpfer aus diesem Paket.' },
    look: {
      type: 'object',
      additionalProperties: false,
      properties: { colors: { type: 'array', minItems: 2, maxItems: 2, items: color }, label: { type: 'string', pattern: '^[A-Za-z0-9 !?.\\-:/]{1,10}$' } },
    },
  },
};

const arena: Schema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'description', 'wall', 'floor', 'props'],
  description: 'Bild 240×135 Pixel, Wand bis y=100, darunter Boden. Props werden der Reihe nach gemalt.',
  properties: {
    id,
    name: str(2, 30),
    description: str(2, 200),
    wall: color,
    ceiling: color,
    floor: { type: 'object', additionalProperties: false, required: ['color', 'kind'], properties: { color, kind: { enum: FLOOR_KINDS } } },
    props: { type: 'array', maxItems: 40, items: { oneOf: (Object.keys(PROP_FIELDS) as PropType[]).map(propSchema) } },
  },
};

const cpu: Schema = {
  type: 'object',
  additionalProperties: false,
  required: ['aggression', 'specialChance'],
  properties: {
    aggression: { type: 'number', minimum: 0, maximum: 0.2, description: 'Typisch 0.05–0.12' },
    specialChance: { type: 'number', minimum: 0, maximum: 0.2, description: 'Typisch 0.01–0.06' },
    blockChance: { type: 'number', minimum: 0, maximum: 0.6 },
    jumpChance: { type: 'number', minimum: 0, maximum: 0.6, description: 'Typisch 0.002–0.02' },
    skill: { type: 'number', minimum: 0, maximum: 1 },
  },
};

/** The JSON schema of a content pack, for editors, coding agents and LLM tool calls. */
export function contentPackSchema(): Schema {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://southbeat.local/content-pack.schema.json',
    title: 'SouthBeat-Inhaltspaket',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'name', 'version'],
    properties: {
      $schema: { type: 'string' },
      id,
      name: str(2, 40),
      author: str(1, 40),
      version: { const: 1 },
      moves: { type: 'array', maxItems: 30, items: move },
      arenas: { type: 'array', maxItems: 30, items: arena },
      fighters: {
        type: 'array',
        maxItems: 30,
        description: 'Zusätzliche Kämpfer in der Kämpferauswahl.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'title', 'character'],
          properties: { id, title: str(2, 40), character, hitLines: sentences(20) },
        },
      },
      opponents: {
        type: 'array',
        maxItems: 30,
        description: 'Bonus-Gegner der Einzelspieler-Leiter nach dem Endboss.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'title', 'blurb', 'arenaId', 'character', 'cpu', 'lines', 'hitLines', 'chattiness'],
          properties: {
            id,
            title: str(2, 40),
            blurb: str(2, 200),
            arenaId: { type: 'string' },
            character,
            cpu,
            lines: { ...sentences(30), minItems: 1 },
            hitLines: { ...sentences(20), minItems: 1 },
            chattiness: { type: 'number', minimum: 2, maximum: 30, description: 'Sekunden zwischen zwei Sprüchen' },
          },
        },
      },
    },
  };
}
