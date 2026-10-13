export type StatKey = 'strength' | 'speed' | 'defense' | 'stamina';

export type Stats = Record<StatKey, number>;

export type HairStyle = 'short' | 'spiky' | 'long' | 'mohawk' | 'ponytail' | 'afro' | 'bald';
export type BeardStyle = 'none' | 'stubble' | 'mustache' | 'goatee' | 'full' | 'long';
export type OutfitStyle = 'shirt' | 'suit' | 'casual' | 'blouse' | 'uniform' | 'gi' | 'tanktop' | 'jacket' | 'hoodie' | 'ninja' | 'wrestler' | 'armor';

export type BodyType = 'normal' | 'heavy' | 'slim';
export type Accessory = 'none' | 'glasses' | 'sunglasses' | 'headset' | 'cap';

export interface Appearance {
  bodyType: BodyType;
  accessory: Accessory;
  skinColor: string;
  eyeColor: string;
  hairColor: string;
  hairStyle: HairStyle;
  beardStyle: BeardStyle;
  outfitColor: string;
  outfitStyle: OutfitStyle;
}

export type MoveSlot = 'light' | 'heavy' | 'kick' | 'special' | 'ultimate';

export interface Move {
  id: string;
  name: string;
  slot: MoveSlot;
  /** Base damage before the strength stat is applied. */
  damage: number;
  /** Frames before the hit becomes active (60 fps). */
  startupFrames: number;
  /** Overrides for signature moves; normal moves use the slot's defaults. */
  reach?: number;
  knockback?: number;
  hitstun?: number;
  /** Number of hits in a combo; damage applies per hit. */
  hits?: number;
  /** Projectile speed in pixels per frame; the move hits when the projectile reaches the target. */
  projectileSpeed?: number;
  /** Signature moves of single-player opponents can't be picked in the editor. */
  exclusive?: boolean;
}

export type MoveSet = Record<MoveSlot, string>;

export interface Character {
  name: string;
  appearance: Appearance;
  moves: MoveSet;
  stats: Stats;
}

export const STAT_KEYS: readonly StatKey[] = ['strength', 'speed', 'defense', 'stamina'];
export const MOVE_SLOTS: readonly MoveSlot[] = ['light', 'heavy', 'kick', 'special', 'ultimate'];

export const BODY_LABELS: Record<BodyType, string> = {
  normal: 'Normal',
  heavy: 'Kräftig',
  slim: 'Schlank',
};

export const ACCESSORY_LABELS: Record<Accessory, string> = {
  none: 'Keins',
  glasses: 'Brille',
  sunglasses: 'Sonnenbrille',
  headset: 'Headset',
  cap: 'Offiziersmütze',
};

export const HAIR_LABELS: Record<HairStyle, string> = {
  short: 'Kurz',
  spiky: 'Stachelig',
  long: 'Lang',
  mohawk: 'Irokese',
  ponytail: 'Zopf',
  afro: 'Afro',
  bald: 'Glatze',
};

export const BEARD_LABELS: Record<BeardStyle, string> = {
  none: 'Kein Bart',
  stubble: 'Dreitagebart',
  mustache: 'Schnurrbart',
  goatee: 'Ziegenbart',
  full: 'Vollbart',
  long: 'Langer Bart',
};

export const OUTFIT_LABELS: Record<OutfitStyle, string> = {
  shirt: 'Hemd mit Krawatte',
  suit: 'Anzug',
  casual: 'Business Casual',
  blouse: 'Bluse & Rock',
  uniform: 'Uniform',
  gi: 'Karate-Gi',
  tanktop: 'Tanktop',
  jacket: 'Lederjacke',
  hoodie: 'Hoodie',
  ninja: 'Ninja',
  wrestler: 'Wrestler',
  armor: 'Rüstung',
};

export const BODY_TYPES = Object.keys(BODY_LABELS) as BodyType[];
export const ACCESSORIES = Object.keys(ACCESSORY_LABELS) as Accessory[];
export const HAIR_STYLES = Object.keys(HAIR_LABELS) as HairStyle[];
export const BEARD_STYLES = Object.keys(BEARD_LABELS) as BeardStyle[];
export const OUTFIT_STYLES = Object.keys(OUTFIT_LABELS) as OutfitStyle[];

export const STAT_LABELS: Record<StatKey, string> = {
  strength: 'Stärke',
  speed: 'Tempo',
  defense: 'Verteidigung',
  stamina: 'Ausdauer',
};

export const SLOT_LABELS: Record<MoveSlot, string> = {
  light: 'Leichter Schlag',
  heavy: 'Schwerer Schlag',
  kick: 'Tritt',
  special: 'Spezialangriff',
  ultimate: 'Ultimativer Angriff',
};

/**
 * Every fighter is a programmer, so the moves come from the office desk.
 * Faster moves hit softer, keeping the choice about play style rather than raw power.
 */
export const MOVES: readonly Move[] = [
  { id: 'keyboard-jab', name: 'Tastatur-Jab', slot: 'light', damage: 4, startupFrames: 4 },
  { id: 'mouse-flick', name: 'Maus-Schnipser', slot: 'light', damage: 5, startupFrames: 6 },
  { id: 'monitor-slam', name: 'Monitor-Hammer', slot: 'heavy', damage: 12, startupFrames: 14 },
  { id: 'laptop-uppercut', name: 'Laptop-Uppercut', slot: 'heavy', damage: 10, startupFrames: 10 },
  { id: 'chair-spin', name: 'Drehstuhl-Kick', slot: 'kick', damage: 9, startupFrames: 11 },
  { id: 'cable-sweep', name: 'Kabelsalat-Feger', slot: 'kick', damage: 7, startupFrames: 8 },
  { id: 'coffee-throw', name: 'Kaffee-Wurf', slot: 'special', damage: 8, startupFrames: 13, projectileSpeed: 4 },
  { id: 'merge-conflict', name: 'Merge-Konflikt', slot: 'special', damage: 11, startupFrames: 16 },
  { id: 'stack-overflow', name: 'Stack Overflow', slot: 'special', damage: 10, startupFrames: 7 },
  // Ultimates only work with a full action bar.
  { id: 'friday-deploy', name: 'Freitags-Deploy', slot: 'ultimate', damage: 30, startupFrames: 20 },
  { id: 'rm-rf', name: 'rm -rf /', slot: 'ultimate', damage: 34, startupFrames: 28 },
  { id: 'blue-screen', name: 'Bluescreen', slot: 'ultimate', damage: 27, startupFrames: 14 },
  { id: 'infinite-loop', name: 'Endlosschleife', slot: 'ultimate', damage: 24, startupFrames: 10 },

  // Signature moves of the single-player opponents.
  { id: 'belly-bump', name: 'Bauch-Schubser', slot: 'special', damage: 9, startupFrames: 12, reach: 34, knockback: 40, hitstun: 26, exclusive: true },
  { id: 'tank-roll', name: 'Panzer-Walze', slot: 'special', damage: 18, startupFrames: 30, reach: 230, projectileSpeed: 3, knockback: 20, hitstun: 40, exclusive: true },
  { id: 'combo-flurry', name: 'Kombo-Wirbel', slot: 'light', damage: 3, startupFrames: 3, hits: 3, exclusive: true },
  { id: 'combo-chain', name: 'Kettenkombo', slot: 'heavy', damage: 4, startupFrames: 6, hits: 4, knockback: 4, exclusive: true },
  { id: 'rack-slam', name: 'Rack-Schlag', slot: 'heavy', damage: 13, startupFrames: 15, reach: 36, exclusive: true },
  { id: 'hdd-throw', name: 'Festplatten-Wurf', slot: 'special', damage: 10, startupFrames: 14, reach: 150, projectileSpeed: 5, exclusive: true },
  { id: 'tomato-throw', name: 'Tomatenwurf', slot: 'special', damage: 7, startupFrames: 10, reach: 160, projectileSpeed: 4, exclusive: true },
  { id: 'tomato-rain', name: 'Tomatenhagel', slot: 'ultimate', damage: 8, startupFrames: 18, reach: 140, hits: 4, exclusive: true },
];

/** Moves a player can pick in the editor. */
export function movesForSlot(slot: MoveSlot): Move[] {
  return MOVES.filter((m) => m.slot === slot && !m.exclusive);
}

export function findMove(id: string): Move | undefined {
  return MOVES.find((m) => m.id === id);
}
