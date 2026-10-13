import { Character, Move, MoveSlot, findMove } from '../character/character.model';

/**
 * Fight rules, independent of rendering and input so they can run in tests
 * and, later, on the server for multiplayer. One call to `step` is one frame.
 */

export const FPS = 60;
export const ROUND_FRAMES = 99 * FPS;
export const METER_MAX = 100;
/** Passive charge: an idle fighter fills the bar in about 45 seconds. */
const METER_PER_FRAME = METER_MAX / (45 * FPS);
const METER_PER_DAMAGE_DEALT = 1.2;
const METER_PER_DAMAGE_TAKEN = 0.8;
/** A button pressed while busy is remembered this long, so inputs don't get lost mid-attack. */
const BUFFER_FRAMES = 12;

export const STAGE_LEFT = 20;
export const STAGE_RIGHT = 220;
const MIN_DISTANCE = 22;
const ACTIVE_FRAMES = 4;

interface SlotTiming {
  reach: number;
  recovery: number;
  hitstun: number;
  knockback: number;
}

const TIMING: Record<MoveSlot, SlotTiming> = {
  light: { reach: 30, recovery: 8, hitstun: 12, knockback: 3 },
  heavy: { reach: 32, recovery: 16, hitstun: 20, knockback: 8 },
  kick: { reach: 38, recovery: 12, hitstun: 16, knockback: 6 },
  special: { reach: 70, recovery: 18, hitstun: 18, knockback: 5 },
  ultimate: { reach: 95, recovery: 24, hitstun: 45, knockback: 26 },
};

export interface Controls {
  left: boolean;
  right: boolean;
  /** Attack buttons are true only on the frame they were pressed. */
  light: boolean;
  heavy: boolean;
  kick: boolean;
  special: boolean;
  ultimate: boolean;
}

export const NO_INPUT: Controls = { left: false, right: false, light: false, heavy: false, kick: false, special: false, ultimate: false };

export interface Action {
  slot: MoveSlot;
  move: Move;
  frame: number;
  startup: number;
  total: number;
  hit: boolean;
}

export interface FighterState {
  character: Character;
  x: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  meter: number;
  action: Action | null;
  hitstun: number;
  buffered: { slot: MoveSlot; frames: number } | null;
}

export type FightEvent =
  | { type: 'attack'; fighter: number; slot: MoveSlot }
  | { type: 'hit'; attacker: number; slot: MoveSlot; damage: number }
  | { type: 'ultimate'; fighter: number; move: Move };

export interface FightState {
  arenaId: string;
  frame: number;
  fighters: [FighterState, FighterState];
  /** Index of the winning fighter, 'draw', or null while the round runs. */
  winner: 0 | 1 | 'draw' | null;
  events: FightEvent[];
}

export function maxHpFor(c: Character): number {
  return 80 + c.stats.stamina * 8;
}

export function walkSpeed(c: Character): number {
  return 0.6 + c.stats.speed * 0.1;
}

export function startupFor(c: Character, move: Move): number {
  return Math.max(2, Math.round(move.startupFrames * (1.15 - c.stats.speed * 0.03)));
}

export function damageFor(attacker: Character, defender: Character, move: Move): number {
  const power = 0.8 + attacker.stats.strength * 0.04;
  const guard = 1.1 - defender.stats.defense * 0.03;
  return Math.max(1, Math.round(move.damage * power * guard));
}

export function createFight(a: Character, b: Character, arenaId: string): FightState {
  const fighter = (c: Character, x: number, facing: 1 | -1): FighterState => ({
    character: c,
    x,
    facing,
    hp: maxHpFor(c),
    maxHp: maxHpFor(c),
    meter: 0,
    action: null,
    hitstun: 0,
    buffered: null,
  });
  return { arenaId, frame: 0, fighters: [fighter(a, 86, 1), fighter(b, 154, -1)], winner: null, events: [] };
}

export function canUseUltimate(f: FighterState): boolean {
  return f.meter >= METER_MAX && f.action === null && f.hitstun === 0;
}

export function step(state: FightState, controls: [Controls, Controls]): void {
  state.events = [];
  if (state.winner !== null) return;
  state.frame++;

  state.fighters.forEach((f, i) => {
    const o = state.fighters[1 - i];
    f.meter = Math.min(METER_MAX, f.meter + METER_PER_FRAME);
    const pressed = pressedSlot(f, controls[i]);
    if (pressed) f.buffered = { slot: pressed, frames: BUFFER_FRAMES };
    // A pressed ultimate waits until the fighter is free; normal attacks expire.
    else if (f.buffered && f.buffered.slot !== 'ultimate' && --f.buffered.frames <= 0) f.buffered = null;
    if (f.hitstun > 0) {
      f.hitstun--;
      return;
    }
    if (f.action) {
      advanceAction(state, i, f, o);
      return;
    }
    if (f.buffered && (f.buffered.slot !== 'ultimate' || f.meter >= METER_MAX)) {
      startAction(state, i, f, f.buffered.slot);
      f.buffered = null;
      return;
    }
    const dir = (controls[i].right ? 1 : 0) - (controls[i].left ? 1 : 0);
    f.x += dir * walkSpeed(f.character);
  });

  const [a, b] = state.fighters;
  keepApart(a, b);
  if (!a.action) a.facing = b.x >= a.x ? 1 : -1;
  if (!b.action) b.facing = a.x >= b.x ? 1 : -1;

  if (a.hp <= 0 || b.hp <= 0) {
    state.winner = a.hp <= 0 && b.hp <= 0 ? 'draw' : a.hp <= 0 ? 1 : 0;
  } else if (state.frame >= ROUND_FRAMES) {
    const ra = a.hp / a.maxHp;
    const rb = b.hp / b.maxHp;
    state.winner = ra === rb ? 'draw' : ra > rb ? 0 : 1;
  }
}

function pressedSlot(f: FighterState, c: Controls): MoveSlot | null {
  if (c.ultimate && f.meter >= METER_MAX) return 'ultimate';
  if (c.heavy) return 'heavy';
  if (c.kick) return 'kick';
  if (c.special) return 'special';
  if (c.light) return 'light';
  return null;
}

function startAction(state: FightState, i: number, f: FighterState, slot: MoveSlot): void {
  const move = findMove(f.character.moves[slot]);
  if (!move) return;
  const startup = startupFor(f.character, move);
  f.action = { slot, move, frame: 0, startup, total: startup + ACTIVE_FRAMES + TIMING[slot].recovery, hit: false };
  if (slot === 'ultimate') {
    f.meter = 0;
    state.events.push({ type: 'ultimate', fighter: i, move });
  } else {
    state.events.push({ type: 'attack', fighter: i, slot });
  }
}

function advanceAction(state: FightState, i: number, f: FighterState, o: FighterState): void {
  const action = f.action!;
  action.frame++;
  const active = action.frame > action.startup && action.frame <= action.startup + ACTIVE_FRAMES;
  if (active && !action.hit && inReach(f, o, action.slot)) {
    action.hit = true;
    const timing = TIMING[action.slot];
    const damage = damageFor(f.character, o.character, action.move);
    o.hp = Math.max(0, o.hp - damage);
    // A started ultimate cannot be interrupted, otherwise the spent bar would be lost.
    if (o.action?.slot !== 'ultimate') {
      o.hitstun = timing.hitstun;
      o.action = null;
      o.x += f.facing * timing.knockback;
    }
    if (action.slot !== 'ultimate') f.meter = Math.min(METER_MAX, f.meter + damage * METER_PER_DAMAGE_DEALT);
    o.meter = Math.min(METER_MAX, o.meter + damage * METER_PER_DAMAGE_TAKEN);
    state.events.push({ type: 'hit', attacker: i, slot: action.slot, damage });
  }
  if (action.frame >= action.total) f.action = null;
}

export function inReach(f: FighterState, o: FighterState, slot: MoveSlot): boolean {
  const dx = o.x - f.x;
  return Math.sign(dx) === f.facing && Math.abs(dx) <= TIMING[slot].reach;
}

/** True while an attack's hitbox is out, for drawing effects. */
export function isActive(f: FighterState): boolean {
  const a = f.action;
  return !!a && a.frame > a.startup && a.frame <= a.startup + ACTIVE_FRAMES;
}

export function reachOf(slot: MoveSlot): number {
  return TIMING[slot].reach;
}

function keepApart(a: FighterState, b: FighterState): void {
  for (const f of [a, b]) f.x = Math.min(STAGE_RIGHT, Math.max(STAGE_LEFT, f.x));
  const gap = Math.abs(b.x - a.x);
  if (gap >= MIN_DISTANCE) return;
  const push = (MIN_DISTANCE - gap) / 2;
  const [left, right] = a.x <= b.x ? [a, b] : [b, a];
  left.x -= push;
  right.x += push;
  if (left.x < STAGE_LEFT) {
    right.x += STAGE_LEFT - left.x;
    left.x = STAGE_LEFT;
  }
  if (right.x > STAGE_RIGHT) {
    left.x -= right.x - STAGE_RIGHT;
    right.x = STAGE_RIGHT;
  }
}

/** A simple computer opponent: walks in, attacks in range and fires its ultimate when ready. */
export function cpuControls(state: FightState, i: number, random: () => number): Controls {
  const f = state.fighters[i];
  const o = state.fighters[1 - i];
  const c: Controls = { ...NO_INPUT };
  if (f.action || f.hitstun > 0 || state.winner !== null) return c;
  const dist = Math.abs(o.x - f.x);
  const toward: 'left' | 'right' = o.x > f.x ? 'right' : 'left';
  const away: 'left' | 'right' = toward === 'right' ? 'left' : 'right';

  if (canUseUltimate(f) && dist <= reachOf('ultimate') - 10) {
    c.ultimate = true;
  } else if (dist <= reachOf('light')) {
    const r = random();
    if (r < 0.04) c.light = true;
    else if (r < 0.06) c.heavy = true;
    else if (r < 0.08) c.kick = true;
    else if (r < 0.1) c[away] = true;
  } else if (dist <= reachOf('special') && random() < 0.015) {
    c.special = true;
  } else {
    c[toward] = random() < 0.9;
  }
  return c;
}
