export type StatKey = 'strength' | 'speed' | 'defense' | 'stamina';

export type Stats = Record<StatKey, number>;

export type HairStyle = 'short' | 'spiky' | 'long' | 'bald';
export type OutfitStyle = 'gi' | 'tanktop' | 'jacket';

export interface Appearance {
  skinColor: string;
  hairColor: string;
  hairStyle: HairStyle;
  outfitColor: string;
  outfitStyle: OutfitStyle;
}

export type MoveSlot = 'light' | 'heavy' | 'kick' | 'special';

export interface Move {
  id: string;
  name: string;
  slot: MoveSlot;
  /** Base damage before the strength stat is applied. */
  damage: number;
  /** Frames before the hit becomes active (60 fps). */
  startupFrames: number;
}

export type MoveSet = Record<MoveSlot, string>;

export interface Character {
  name: string;
  appearance: Appearance;
  moves: MoveSet;
  stats: Stats;
}

export const STAT_KEYS: readonly StatKey[] = ['strength', 'speed', 'defense', 'stamina'];
export const MOVE_SLOTS: readonly MoveSlot[] = ['light', 'heavy', 'kick', 'special'];
export const HAIR_STYLES: readonly HairStyle[] = ['short', 'spiky', 'long', 'bald'];
export const OUTFIT_STYLES: readonly OutfitStyle[] = ['gi', 'tanktop', 'jacket'];

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
};

/**
 * Every move in a slot is tuned so faster moves hit softer, keeping the
 * choice about play style rather than raw power.
 */
export const MOVES: readonly Move[] = [
  { id: 'jab', name: 'Jab', slot: 'light', damage: 4, startupFrames: 4 },
  { id: 'chop', name: 'Handkantenschlag', slot: 'light', damage: 5, startupFrames: 6 },
  { id: 'haymaker', name: 'Haymaker', slot: 'heavy', damage: 12, startupFrames: 14 },
  { id: 'uppercut', name: 'Uppercut', slot: 'heavy', damage: 10, startupFrames: 10 },
  { id: 'roundhouse', name: 'Roundhouse', slot: 'kick', damage: 9, startupFrames: 11 },
  { id: 'sweep', name: 'Feger', slot: 'kick', damage: 7, startupFrames: 8 },
  { id: 'fireball', name: 'Feuerball', slot: 'special', damage: 8, startupFrames: 13 },
  { id: 'dash-punch', name: 'Sturmschlag', slot: 'special', damage: 11, startupFrames: 16 },
  { id: 'grab', name: 'Wurf', slot: 'special', damage: 10, startupFrames: 7 },
];

export function movesForSlot(slot: MoveSlot): Move[] {
  return MOVES.filter((m) => m.slot === slot);
}

export function findMove(id: string): Move | undefined {
  return MOVES.find((m) => m.id === id);
}
