import { Appearance, Character, HairStyle, OutfitStyle, BeardStyle, Accessory, BodyType } from '../character/character.model';
import { defaultCharacter } from '../character/balance';
import { Painter, seeded, shade } from '../arena/painter';
import { ARENA_HEIGHT, ARENA_WIDTH, FLOOR_Y } from '../arena/props';
import { findArena, paintArena } from '../arena/arenas';
import { CpuProfile } from '../fight/combat';
import { OPPONENTS, Opponent } from '../singleplayer/opponents';

/** One screen of a stage; the camera locks on it until all its waves are beaten. */
export const SEGMENT_WIDTH = ARENA_WIDTH;
export const SEGMENTS_PER_STAGE = 3;
export const WORLD_WIDTH = SEGMENT_WIDTH * SEGMENTS_PER_STAGE;

export type ItemKind = 'coffee' | 'pizza' | 'keyboard';

export const ITEM_NAMES: Record<ItemKind, string> = {
  coffee: 'Kaffee',
  pizza: 'Pizza',
  keyboard: 'Tastatur',
};

/** Generic enemies that fill the waves before the boss. */
export interface Grunt {
  kind: string;
  name: string;
  character: Character;
  hp: number;
  cpu: CpuProfile;
  speed: number;
}

export interface StageDef {
  index: number;
  arenaId: string;
  boss: Opponent;
  /** Enemies per wave, for each of the segments; the last segment also has the boss. */
  waves: string[][][];
  items: { kind: ItemKind; x: number; z: number }[];
}

const SKINS = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a1e'];
const HAIR = ['#111111', '#3b2414', '#5a3d1e', '#a33a1c', '#d9b25b', '#7a7a7a'];

const GRUNT_TYPES: Record<string, { name: string; outfit: OutfitStyle[]; colors: string[]; hp: number; stats: Character['stats']; cpu: CpuProfile; speed: number; moves: Character['moves'] }> = {
  intern: {
    name: 'Praktikant',
    outfit: ['hoodie', 'casual', 'tanktop'],
    colors: ['#2e8b57', '#d35400', '#7f8c8d', '#2a6fdb'],
    hp: 34,
    stats: { strength: 3, speed: 6, defense: 3, stamina: 3 },
    cpu: { aggression: 0.05, specialChance: 0 },
    speed: 0.9,
    moves: { light: 'keyboard-jab', heavy: 'monitor-slam', kick: 'chair-spin', special: 'coffee-throw', ultimate: 'friday-deploy' },
  },
  consultant: {
    name: 'Berater',
    outfit: ['suit', 'shirt'],
    colors: ['#2b2f3a', '#34495e', '#6c5ce7', '#9fc3e6'],
    hp: 52,
    stats: { strength: 5, speed: 4, defense: 5, stamina: 5 },
    cpu: { aggression: 0.06, specialChance: 0.008 },
    speed: 0.7,
    moves: { light: 'mouse-flick', heavy: 'laptop-uppercut', kick: 'cable-sweep', special: 'usb-shot', ultimate: 'friday-deploy' },
  },
  scrum: {
    name: 'Scrum Master',
    outfit: ['jacket', 'blouse', 'casual'],
    colors: ['#c0392b', '#f39c12', '#16a085', '#8e44ad'],
    hp: 44,
    stats: { strength: 4, speed: 7, defense: 4, stamina: 4 },
    cpu: { aggression: 0.08, specialChance: 0.006 },
    speed: 1,
    moves: { light: 'keyboard-jab', heavy: 'monitor-slam', kick: 'chair-spin', special: 'keyboard-lob', ultimate: 'friday-deploy' },
  },
};

/** A random-looking but reproducible enemy, so every wave looks a bit different. */
export function makeGrunt(kind: string, seed: number): Grunt {
  const t = GRUNT_TYPES[kind] ?? GRUNT_TYPES['intern'];
  const r = seeded(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(r() * list.length)];
  const appearance: Appearance = {
    ...defaultCharacter().appearance,
    bodyType: pick<BodyType>(['normal', 'normal', 'slim', 'heavy']),
    accessory: pick<Accessory>(['none', 'none', 'glasses', 'headset', 'cap']),
    skinColor: pick(SKINS),
    hairColor: pick(HAIR),
    hairStyle: pick<HairStyle>(['short', 'spiky', 'long', 'mohawk', 'ponytail', 'afro', 'receding', 'bald']),
    beardStyle: pick<BeardStyle>(['none', 'none', 'stubble', 'goatee', 'full', 'mustache']),
    outfitStyle: pick(t.outfit),
    outfitColor: pick(t.colors),
  };
  return {
    kind,
    name: t.name,
    character: { name: t.name, appearance, moves: t.moves, stats: t.stats },
    hp: t.hp,
    cpu: t.cpu,
    speed: t.speed,
  };
}

/** Five stages, one per ladder boss, in their own arenas. Later stages send more and tougher enemies. */
export const STAGES: readonly StageDef[] = OPPONENTS.map((boss, index) => {
  const extra = index >= 2 ? ['scrum'] : [];
  const tough = index >= 1 ? 'consultant' : 'intern';
  return {
    index,
    arenaId: boss.arenaId,
    boss,
    waves: [
      [['intern', 'intern'], ['intern', tough, ...extra]],
      [['intern', tough], [tough, 'scrum', 'intern', ...extra]],
      [index >= 3 ? ['intern', 'consultant'] : ['intern']],
    ],
    items: [
      { kind: 'coffee', x: 170, z: 8 },
      { kind: 'keyboard', x: 300, z: 20 },
      { kind: 'coffee', x: 420, z: 4 },
      { kind: 'pizza', x: 560, z: 14 },
    ],
  };
});

/**
 * The stage background: the arena repeated over three screens, with a pillar or
 * doorway hiding each seam so it reads as one long office.
 */
export function paintStage(stage: StageDef): Painter {
  const arena = paintArena(findArena(stage.arenaId));
  const p = new Painter(WORLD_WIDTH, ARENA_HEIGHT);
  for (let seg = 0; seg < SEGMENTS_PER_STAGE; seg++) {
    for (let y = 0; y < ARENA_HEIGHT; y++) {
      for (let x = 0; x < ARENA_WIDTH; x++) p.set(seg * SEGMENT_WIDTH + x, y, arena.get(x, y));
    }
  }
  for (let seg = 1; seg < SEGMENTS_PER_STAGE; seg++) {
    const x = seg * SEGMENT_WIDTH - 5;
    const wall = arena.get(ARENA_WIDTH - 1, 20);
    p.rect(x, 0, 10, FLOOR_Y, shade(wall, -0.35));
    p.rect(x + 1, 0, 2, FLOOR_Y, shade(wall, -0.15));
    p.rect(x + 8, 0, 2, FLOOR_Y, shade(wall, -0.55));
    p.rect(x - 2, FLOOR_Y - 3, 14, 3, shade(wall, -0.6));
  }
  // The boss segment gets a sign so you know who is waiting.
  p.text(SEGMENT_WIDTH * (SEGMENTS_PER_STAGE - 1) + 8, 4, 'BOSS', '#ff5a5a');
  return p;
}
