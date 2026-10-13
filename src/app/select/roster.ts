import { Character } from '../character/character.model';
import { SPARRING_PARTNER } from '../character/sparring';
import { CpuProfile, DEFAULT_CPU } from '../fight/combat';
import { HIT_LINES } from '../fight/hit-lines';
import { OPPONENTS } from '../singleplayer/opponents';

/** One fighter on the character select screen. */
export interface RosterEntry {
  id: string;
  name: string;
  title: string;
  character: Character;
  hitLines: readonly string[];
  cpu: CpuProfile;
  /** Locked fighters show up as a silhouette until they are unlocked. */
  locked: boolean;
}

/** The player's own fighter from the editor. */
export const OWN_FIGHTER = 'me';
/** Picks any unlocked fighter when the fight starts. */
export const RANDOM_FIGHTER = 'random';
/** The final boss is unlocked by beating him in single player. */
export const BOSS_ID = 'gustav-grossmaul';

/** Fighters that are the same for everyone, so the server can look them up by id. */
export function builtInFighter(id: string): RosterEntry | undefined {
  if (id === 'sparring') {
    return { id, name: SPARRING_PARTNER.name, title: 'Trainingspartner', character: SPARRING_PARTNER, hitLines: HIT_LINES, cpu: DEFAULT_CPU, locked: false };
  }
  const o = OPPONENTS.find((x) => x.id === id);
  if (!o) return undefined;
  return { id, name: o.character.name, title: o.title, character: o.character, hitLines: o.hitLines, cpu: o.cpu, locked: false };
}

export function roster(own: Character, beaten: readonly string[]): RosterEntry[] {
  const mine: RosterEntry = { id: OWN_FIGHTER, name: own.name, title: 'Dein Kämpfer', character: own, hitLines: HIT_LINES, cpu: DEFAULT_CPU, locked: false };
  const others = ['sparring', ...OPPONENTS.map((o) => o.id)].map((id) => builtInFighter(id)!);
  return [mine, ...others.map((e) => ({ ...e, locked: e.id === BOSS_ID && !beaten.includes(BOSS_ID) }))];
}

/** Turns a pick into a fighter; random picks draw from the unlocked fighters. */
export function resolvePick(id: string, entries: readonly RosterEntry[], random: () => number): RosterEntry {
  const open = entries.filter((e) => !e.locked);
  if (id === RANDOM_FIGHTER) return open[Math.floor(random() * open.length)];
  return open.find((e) => e.id === id) ?? open[0];
}
