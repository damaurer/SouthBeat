import {
  ACCESSORIES,
  BEARD_STYLES,
  BODY_TYPES,
  Character,
  HAIR_STYLES,
  MOVE_SLOTS,
  OUTFIT_STYLES,
  SHAPE_KEYS,
  SHAPE_MAX,
  SHAPE_MIN,
  Shape,
  STAT_KEYS,
  StatKey,
  Stats,
  findMove,
} from './character.model';
import { DEFAULT_ART, isValidArt } from './projectile-art';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** The fixed frame that keeps every custom character fair. */
export const STAT_MIN = 1;
export const STAT_MAX = 10;
export const STAT_BUDGET = 22;

export function totalPoints(stats: Stats): number {
  return STAT_KEYS.reduce((sum, key) => sum + stats[key], 0);
}

export function remainingPoints(stats: Stats): number {
  return STAT_BUDGET - totalPoints(stats);
}

export function canIncrease(stats: Stats, key: StatKey): boolean {
  return stats[key] < STAT_MAX && remainingPoints(stats) > 0;
}

export function canDecrease(stats: Stats, key: StatKey): boolean {
  return stats[key] > STAT_MIN;
}

/** Returns new stats with one stat changed, or the same object if the change breaks the rules. */
export function adjustStat(stats: Stats, key: StatKey, delta: 1 | -1): Stats {
  const allowed = delta > 0 ? canIncrease(stats, key) : canDecrease(stats, key);
  return allowed ? { ...stats, [key]: stats[key] + delta } : stats;
}

export function statErrors(stats: Stats, budget = STAT_BUDGET): string[] {
  const errors: string[] = [];
  for (const key of STAT_KEYS) {
    const value = stats[key];
    if (!Number.isInteger(value) || value < STAT_MIN || value > STAT_MAX) {
      errors.push(`${key} muss zwischen ${STAT_MIN} und ${STAT_MAX} liegen.`);
    }
  }
  if (totalPoints(stats) > budget) {
    errors.push(`Es dürfen höchstens ${budget} Punkte verteilt werden.`);
  }
  return errors;
}

/** Slider values: only known keys, each a whole number within the slider range. */
export function isValidShape(shape: unknown): shape is Shape {
  if (!shape || typeof shape !== 'object' || Array.isArray(shape)) return false;
  return Object.entries(shape).every(
    ([key, value]) => (SHAPE_KEYS as readonly string[]).includes(key) && Number.isInteger(value) && value >= SHAPE_MIN && value <= SHAPE_MAX,
  );
}

/**
 * Content packs check their fighters with their own point budget, and they may use the
 * signature moves defined in the same pack.
 */
export interface CharacterRules {
  budget?: number;
  allowExclusive?: (moveId: string) => boolean;
}

/** Full check for a character, e.g. before it may enter a multiplayer match. */
export function characterErrors(character: Character, rules: CharacterRules = {}): string[] {
  if (!character || typeof character !== 'object' || !character.stats || !character.moves || typeof character.name !== 'string') {
    return ['Ein Charakter braucht name, appearance, moves und stats.'];
  }
  const errors = statErrors(character.stats, rules.budget);
  const name = character.name.trim();
  if (name.length < 2 || name.length > 16) {
    errors.push('Der Name muss 2 bis 16 Zeichen lang sein.');
  }
  const look = character.appearance;
  if (
    !BODY_TYPES.includes(look?.bodyType) ||
    !ACCESSORIES.includes(look?.accessory) ||
    !HAIR_STYLES.includes(look?.hairStyle) ||
    !BEARD_STYLES.includes(look?.beardStyle) ||
    !OUTFIT_STYLES.includes(look?.outfitStyle) ||
    ![look.skinColor, look.eyeColor, look.hairColor, look.outfitColor].every((c) => HEX_COLOR.test(c))
  ) {
    errors.push('Ungültiges Aussehen.');
  }
  if (look?.shape !== undefined && !isValidShape(look.shape)) {
    errors.push('Ungültige Proportionen.');
  }
  if (character.projectileArt !== undefined && !isValidArt(character.projectileArt)) {
    errors.push('Ungültige Geschoss-Zeichnung.');
  }
  for (const slot of MOVE_SLOTS) {
    const move = findMove(character.moves[slot]);
    if (!move || move.slot !== slot || (move.exclusive && !rules.allowExclusive?.(move.id))) {
      errors.push(`Ungültiger Move für ${slot}.`);
    }
  }
  return errors;
}

export function defaultCharacter(): Character {
  return {
    name: 'Rookie',
    appearance: {
      bodyType: 'normal',
      accessory: 'none',
      skinColor: '#e0ac69',
      eyeColor: '#3a6ea5',
      hairColor: '#3b2414',
      hairStyle: 'short',
      beardStyle: 'none',
      outfitColor: '#9fc3e6',
      outfitStyle: 'shirt',
    },
    moves: { light: 'keyboard-jab', heavy: 'laptop-uppercut', kick: 'chair-spin', special: 'coffee-throw', ultimate: 'friday-deploy' },
    stats: { strength: 5, speed: 5, defense: 5, stamina: 5 },
    projectileArt: [...DEFAULT_ART],
  };
}
