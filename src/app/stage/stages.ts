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
  armor: boolean;
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

interface GruntType {
  name: string;
  /** What the enemy is about, for the README and the enemy list. */
  ability: string;
  outfit: OutfitStyle[];
  colors: string[];
  accessory?: Accessory[];
  body?: BodyType[];
  hp: number;
  stats: Character['stats'];
  cpu: CpuProfile;
  speed: number;
  moves: Character['moves'];
  /** Light hits and kicks don't stop it; only heavy hits, specials and ultimates do. */
  armor?: boolean;
  /** Things it says now and then when it gets hit. */
  lines: string[];
}

export const GRUNT_TYPES: Record<string, GruntType> = {
  intern: {
    name: 'Praktikant',
    outfit: ['hoodie', 'casual', 'tanktop'],
    colors: ['#2e8b57', '#d35400', '#7f8c8d', '#2a6fdb'],
    hp: 34,
    stats: { strength: 3, speed: 6, defense: 3, stamina: 3 },
    cpu: { aggression: 0.05, specialChance: 0 },
    speed: 0.9,
    moves: { light: 'keyboard-jab', heavy: 'monitor-slam', kick: 'chair-spin', special: 'coffee-throw', ultimate: 'friday-deploy' },
    ability: 'Schwach, aber viele.',
    lines: ['Ich wollte nur Kaffee holen!', 'Steht das im Onboarding?', 'Ich bin doch nur bis Freitag da!'],
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
    ability: 'Zäh und schießt mit USB-Sticks.',
    lines: ['Das kostet extra.', 'Laut meinem Foliensatz geht das nicht!', 'Wir müssen das ganzheitlich betrachten.'],
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
    ability: 'Schnell und wirft Tastaturen im Bogen.',
    lines: ['Das besprechen wir in der Retro!', 'Timebox ist abgelaufen!', 'Wer blockiert hier?'],
  },
  po: {
    name: 'Product Owner',
    ability: 'Ticket-Flut: wirft drei Tickets auf einmal, über die ganze Tiefe verteilt.',
    outfit: ['shirt', 'blouse', 'jacket'],
    colors: ['#f1c40f', '#e67e22', '#ecf0f1', '#1abc9c'],
    accessory: ['none', 'headset'],
    hp: 46,
    stats: { strength: 4, speed: 5, defense: 4, stamina: 5 },
    cpu: { aggression: 0.05, specialChance: 0.014 },
    speed: 0.85,
    moves: { light: 'priority-poke', heavy: 'monitor-slam', kick: 'chair-spin', special: 'ticket-spam', ultimate: 'friday-deploy' },
    lines: ['Das ist nur ein ganz kleines Ticket!', 'Kann das noch in den Sprint?', 'Der Kunde braucht das gestern.', 'Ist das schon live?'],
  },
  qa: {
    name: 'QA-Testerin',
    ability: 'Schnelle Dreifach-Stiche und Bug-Reports, die über den Boden krabbeln.',
    outfit: ['casual', 'hoodie', 'blouse'],
    colors: ['#8e44ad', '#2ecc71', '#e84393', '#34495e'],
    accessory: ['glasses', 'glasses', 'none'],
    body: ['slim', 'normal'],
    hp: 36,
    stats: { strength: 3, speed: 8, defense: 3, stamina: 4 },
    cpu: { aggression: 0.08, specialChance: 0.012 },
    speed: 1.15,
    moves: { light: 'edge-case', heavy: 'laptop-uppercut', kick: 'cable-sweep', special: 'bug-report', ultimate: 'friday-deploy' },
    lines: ['Bei mir ist das reproduzierbar.', 'Hast du das überhaupt getestet?', 'Ich hab da noch einen Edge Case.', 'Works on my machine zählt nicht!'],
  },
  support: {
    name: 'IT-Support',
    ability: '„Aus- und wieder an“ lähmt dich mehr als eine Sekunde lang; die LAN-Kabel-Peitsche reicht weit.',
    outfit: ['shirt', 'hoodie', 'casual'],
    colors: ['#2a6fdb', '#7f8c8d', '#2c3e50'],
    accessory: ['headset', 'headset', 'cap'],
    hp: 50,
    stats: { strength: 4, speed: 4, defense: 6, stamina: 5 },
    cpu: { aggression: 0.06, specialChance: 0.01 },
    speed: 0.8,
    moves: { light: 'mouse-flick', heavy: 'monitor-slam', kick: 'cable-whip', special: 'reboot', ultimate: 'friday-deploy' },
    lines: ['Haben Sie es schon aus- und wieder eingeschaltet?', 'Mach erstmal ein Ticket auf.', 'Das ist ein Layer-8-Problem.', 'Bei mir geht das.'],
  },
  recruiter: {
    name: 'Recruiterin',
    ability: 'Sehr schnell; der Headhunter-Sprint überbrückt große Abstände.',
    outfit: ['suit', 'blouse', 'jacket'],
    colors: ['#0a66c2', '#ffffff', '#c0392b'],
    accessory: ['none', 'sunglasses'],
    body: ['slim'],
    hp: 32,
    stats: { strength: 3, speed: 9, defense: 2, stamina: 4 },
    cpu: { aggression: 0.07, specialChance: 0.016 },
    speed: 1.35,
    moves: { light: 'keyboard-jab', heavy: 'laptop-uppercut', kick: 'chair-spin', special: 'headhunt', ultimate: 'friday-deploy' },
    lines: ['Spannende Opportunity, ganz unverbindlich!', 'Wir sind wie eine Familie.', 'Obstkorb und Kicker inklusive!', 'Darf ich dich auf LinkedIn adden?'],
  },
  sales: {
    name: 'Vertriebler',
    ability: 'Visitenkarten fliegen schnell und weit; der Golfschwung schleudert dich weg.',
    outfit: ['suit'],
    colors: ['#2b2f3a', '#7a1f1f', '#1f3a7a'],
    accessory: ['sunglasses', 'none'],
    hp: 48,
    stats: { strength: 6, speed: 5, defense: 4, stamina: 4 },
    cpu: { aggression: 0.06, specialChance: 0.012 },
    speed: 0.95,
    moves: { light: 'mouse-flick', heavy: 'golf-swing', kick: 'chair-spin', special: 'card-throw', ultimate: 'friday-deploy' },
    lines: ['Das hab ich dem Kunden schon verkauft!', 'Ist doch nur ein Button.', 'Lass uns das beim Golf klären.', 'Der Vertrag ist schon unterschrieben.'],
  },
  janitor: {
    name: 'Hausmeister',
    ability: 'Gepanzert: leichte Schläge und Tritte halten ihn nicht auf. Wischmop mit großer Reichweite und Putzeimer-Würfe.',
    outfit: ['tanktop', 'casual', 'jacket'],
    colors: ['#4a6fa5', '#7f8c8d', '#5d4037'],
    accessory: ['cap', 'none'],
    body: ['heavy'],
    hp: 70,
    stats: { strength: 6, speed: 3, defense: 7, stamina: 6 },
    cpu: { aggression: 0.05, specialChance: 0.008 },
    speed: 0.6,
    armor: true,
    moves: { light: 'keyboard-jab', heavy: 'monitor-slam', kick: 'mop-sweep', special: 'bucket-lob', ultimate: 'friday-deploy' },
    lines: ['Hier wird nicht gerannt!', 'Ich hab grad erst gewischt!', 'Wer hat den Serverraum offen gelassen?', 'Feierabend ist um vier.'],
  },
};

/** A random-looking but reproducible enemy, so every wave looks a bit different. */
export function makeGrunt(kind: string, seed: number): Grunt {
  const t = GRUNT_TYPES[kind] ?? GRUNT_TYPES['intern'];
  const r = seeded(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(r() * list.length)];
  const appearance: Appearance = {
    ...defaultCharacter().appearance,
    bodyType: pick<BodyType>(t.body ?? ['normal', 'normal', 'slim', 'heavy']),
    accessory: pick<Accessory>(t.accessory ?? ['none', 'none', 'glasses', 'headset', 'cap']),
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
    armor: t.armor ?? false,
  };
}

/**
 * Enemy waves per stage: three screens, each with its waves; the last screen also has the boss.
 * Every office brings its own crowd, and later stages send more and tougher enemies.
 */
const WAVES: string[][][][] = [
  // Teeküche: interns and the first testers and product owners.
  [[['intern', 'intern'], ['intern', 'qa']], [['qa', 'intern'], ['po', 'intern', 'intern']], [['intern']]],
  // Bunker-Office: IT support guards the bunker.
  [[['intern', 'support'], ['consultant', 'qa']], [['support', 'recruiter'], ['support', 'consultant', 'qa']], [['intern']]],
  // Meetingraum: product owners, scrum masters and sales.
  [[['po', 'scrum'], ['consultant', 'po', 'intern']], [['sales', 'scrum'], ['po', 'sales', 'qa', 'intern']], [['scrum']]],
  // Serverraum: support and the janitor who has the keys.
  [[['support', 'janitor'], ['qa', 'support', 'intern']], [['janitor', 'consultant'], ['support', 'qa', 'janitor', 'scrum']], [['support', 'consultant']]],
  // Dachterrasse: everyone Gustav has promised something to.
  [[['sales', 'recruiter'], ['recruiter', 'po', 'intern']], [['janitor', 'sales'], ['sales', 'po', 'recruiter', 'qa']], [['recruiter', 'sales']]],
];

/** Five stages, one per ladder boss, in their own arenas. */
export const STAGES: readonly StageDef[] = OPPONENTS.map((boss, index) => {
  return {
    index,
    arenaId: boss.arenaId,
    boss,
    waves: WAVES[index],
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
