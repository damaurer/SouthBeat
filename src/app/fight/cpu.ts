import { Move, MoveSlot, findMove } from '../character/character.model';
import { Action, Controls, CpuProfile, DEFAULT_CPU, FightState, NO_INPUT, canUseUltimate, reachOf } from './combat';

/** How hard the computer plays, picked by the player. */
export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Leicht', normal: 'Normal', hard: 'Schwer' };
const DIFFICULTY_SKILL: Record<Difficulty, number> = { easy: -0.35, normal: 0, hard: 0.3 };
const DIFFICULTY_KEY = 'southbeat-difficulty';

export function savedDifficulty(): Difficulty {
  try {
    const d = localStorage.getItem(DIFFICULTY_KEY) as Difficulty;
    return DIFFICULTIES.includes(d) ? d : 'normal';
  } catch {
    return 'normal';
  }
}

export function saveDifficulty(d: Difficulty): void {
  try {
    localStorage.setItem(DIFFICULTY_KEY, d);
  } catch {
    // Only a convenience.
  }
}

/**
 * The profile for a fight: each step up the ladder plays a little smarter (rank 0 to 4),
 * and the chosen difficulty shifts everything up or down.
 */
export function cpuFor(profile: CpuProfile, difficulty: Difficulty, rank = 0): CpuProfile {
  const skill = Math.max(0, Math.min(1, (profile.skill ?? 0.35) + rank * 0.1 + DIFFICULTY_SKILL[difficulty]));
  return { ...profile, skill };
}

/** What the computer remembers about the player during one fight. */
interface Memory {
  /** The player's last attacks, newest last, like 'kick-crouch'. */
  seen: string[];
  lastAction: Action | null;
  /** Set after blocking a slow attack: hit back as soon as the guard is down. */
  punish: boolean;
  guards: WeakMap<Action, boolean>;
}

const memories = new WeakMap<FightState, Memory[]>();

function memoryOf(state: FightState, i: number): Memory {
  let list = memories.get(state);
  if (!list) memories.set(state, (list = []));
  return (list[i] ??= { seen: [], lastAction: null, punish: false, guards: new WeakMap() });
}

const kindOf = (a: Action): string => `${a.slot}-${a.stance}`;

/**
 * The computer opponent: walks in, attacks in range and fires its ultimate when ready.
 * It learns during the fight: an attack the player keeps repeating gets blocked, a blocked
 * heavy or special gets punished, and good opponents jump over repeated sweeps.
 */
export function cpuControls(state: FightState, i: number, random: () => number, profile: CpuProfile = DEFAULT_CPU): Controls {
  const f = state.fighters[i];
  const o = state.fighters[1 - i];
  const c: Controls = { ...NO_INPUT };
  if (state.winner !== null || state.intro > 0 || state.roundWinner !== null) return c;
  const skill = profile.skill ?? 0.35;
  const mem = memoryOf(state, i);
  const dist = Math.abs(o.x - f.x);
  const toward: 'left' | 'right' = o.x > f.x ? 'right' : 'left';
  const away: 'left' | 'right' = toward === 'right' ? 'left' : 'right';

  // Remember each new attack of the player.
  if (o.action && o.action !== mem.lastAction) {
    mem.seen = [...mem.seen.slice(-5), kindOf(o.action)];
  }
  mem.lastAction = o.action;
  const repeats = (kind: string): number => {
    let n = 0;
    for (let k = mem.seen.length - 2; k >= 0 && mem.seen[k] === kind; k--) n++;
    return n;
  };

  // Guarding: decide once per incoming attack, then hold the guard while it lasts.
  const threat = o.action && o.action.frame <= o.action.startup + o.action.active && (dist <= reachOf(o.action.move) + 6 || o.action.move.projectileSpeed);
  if (threat && f.y === 0 && !f.action && f.hitstun === 0) {
    const a = o.action!;
    let guard = mem.guards.get(a);
    if (guard === undefined) {
      const base = profile.blockChance ?? DEFAULT_CPU.blockChance!;
      // The second time in a row the same attack is expected; the third time almost always.
      const learned = Math.min(0.95, base * (0.4 + skill) + repeats(kindOf(a)) * skill * 0.55);
      // A sweep seen before can be jumped over instead, by the better opponents.
      if (a.stance === 'crouch' && a.slot === 'kick' && repeats(kindOf(a)) >= 1 && random() < skill - 0.3 && a.frame < a.startup - 4) {
        mem.guards.set(a, false);
        return { ...c, up: true, [toward]: true };
      }
      guard = random() < learned;
      mem.guards.set(a, guard);
      if (guard && (a.slot === 'heavy' || a.slot === 'special') && dist < 60) mem.punish = random() < 0.3 + skill;
    }
    if (guard) {
      c[away] = true;
      c.down = a.level === 'low';
      return c;
    }
  }
  if (f.action || f.hitstun > 0 || f.blockstun > 0) return c;
  if (f.y > 0) {
    // In the air: kick on the way down onto the player.
    if (f.vy < 0 && dist < 40) c.heavy = true;
    return c;
  }
  const move = (slot: MoveSlot): Move | undefined => findMove(f.character.moves[slot]);
  const reaches = (slot: MoveSlot): boolean => {
    const m = move(slot);
    return !!m && dist <= reachOf(m) - 4;
  };

  // Counter right after blocking a slow attack.
  if (mem.punish) {
    mem.punish = false;
    if (dist <= reachOf('heavy') + 4) return { ...c, heavy: true };
  }
  const aggression = profile.aggression * (0.6 + skill);
  if (o.y > 12 && dist <= reachOf('heavy') + 8 && random() < 0.15 + skill * 0.4) {
    // Anti-air: crouching heavy against a jump-in.
    c.down = true;
    c.heavy = true;
  } else if (canUseUltimate(f) && reaches('ultimate')) {
    c.ultimate = true;
  } else if (reaches('special') && random() < profile.specialChance) {
    c.special = true;
  } else if (dist <= reachOf('light')) {
    const r = random() / aggression;
    // Mixes high and low; a player who keeps crouching gets hit by standing heavies.
    const lowPlayer = o.crouching || o.guard === 'low';
    if (r < 0.45) c.light = true;
    else if (r < 0.7) c.heavy = true;
    else if (r < 0.85) c.kick = true;
    else if (r < 1) {
      c.down = !lowPlayer;
      c.kick = true;
    } else if (r < 1.25) c[away] = true;
  } else if (dist > 50 && dist < 110 && random() < (profile.jumpChance ?? DEFAULT_CPU.jumpChance!) * (0.6 + skill)) {
    c.up = true;
    c[toward] = true;
  } else {
    c[toward] = random() < 0.9;
  }
  return c;
}

/** Only for tests: what the computer has noticed so far. */
export function cpuSeen(state: FightState, i: number): readonly string[] {
  return memoryOf(state, i).seen;
}
