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
  /** Jump. */
  up: boolean;
  /** Crouch. */
  down: boolean;
  /** Attack buttons are true only on the frame they were pressed. */
  light: boolean;
  heavy: boolean;
  kick: boolean;
  special: boolean;
  ultimate: boolean;
}

export const NO_INPUT: Controls = { left: false, right: false, up: false, down: false, light: false, heavy: false, kick: false, special: false, ultimate: false };

/**
 * Where an attack hits, as in Street Fighter: mid attacks are blocked standing or
 * crouching, lows (sweeps) only crouching, overheads (jump attacks) only standing.
 */
export type HitLevel = 'mid' | 'low' | 'overhead';
export type Stance = 'stand' | 'crouch' | 'air';

export interface Action {
  slot: MoveSlot;
  /** Crouching and jumping turn the normal attacks into other versions. */
  stance: Stance;
  level: HitLevel;
  move: Move;
  frame: number;
  startup: number;
  /** Frames during which the move can hit. */
  active: number;
  total: number;
  hitsLanded: number;
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
  /** Frames stuck in a block after blocking an attack. */
  blockstun: number;
  /** Height above the ground; 0 means standing on it. */
  y: number;
  vx: number;
  vy: number;
  crouching: boolean;
  /** Set while holding back on the ground: a standing or crouching guard. */
  guard: 'high' | 'low' | null;
  /** Swept or hit by an ultimate: lying on the floor until hitstun runs out. */
  knockedDown: boolean;
  /** Frames left to finish a ↓↘→ motion with an attack button, which fires the special. */
  motion: number;
  /** Progress of the ↓↘→ motion: 1 after ↓, 2 after ↘. */
  motionStep: number;
  buffered: { slot: MoveSlot; frames: number } | null;
}

export type FightEvent =
  | { type: 'attack'; fighter: number; slot: MoveSlot }
  | { type: 'hit'; attacker: number; slot: MoveSlot; damage: number }
  | { type: 'block'; attacker: number; slot: MoveSlot; damage: number }
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
    blockstun: 0,
    y: 0,
    vx: 0,
    vy: 0,
    crouching: false,
    guard: null,
    knockedDown: false,
    motion: 0,
    motionStep: 0,
    buffered: null,
  });
  return { arenaId, frame: 0, fighters: [fighter(a, 86, 1), fighter(b, 154, -1)], winner: null, events: [] };
}

export function canUseUltimate(f: FighterState): boolean {
  return f.meter >= METER_MAX && f.action === null && f.hitstun === 0 && f.blockstun === 0 && f.y === 0;
}

/** Jump physics: about half a second in the air and a little over 30 pixels high. */
const JUMP_SPEED = 4.2;
const GRAVITY = 0.28;
const JUMP_DRIFT = 1.6;
/** Walking backwards is slower, like holding back to block. */
const BACK_WALK = 0.7;
const MOTION_WINDOW = 12;
/** Blocking takes most of the hitstun away; specials and ultimates still chip a little. */
const BLOCKSTUN_SHARE = 0.6;
const CHIP_SHARE = 0.25;
const KNOCKDOWN_FRAMES = 50;

export function isAirborne(f: FighterState): boolean {
  return f.y > 0;
}


export function step(state: FightState, controls: [Controls, Controls]): void {
  state.events = [];
  if (state.winner !== null) return;
  state.frame++;

  state.fighters.forEach((f, i) => {
    const o = state.fighters[1 - i];
    const c = controls[i];
    const forward = f.facing === 1 ? c.right : c.left;
    const back = f.facing === 1 ? c.left : c.right;
    f.meter = Math.min(METER_MAX, f.meter + METER_PER_FRAME);
    trackMotion(f, c.down, forward);
    let pressed = pressedSlot(f, c);
    // ↓↘→ plus an attack button fires the special, the classic fireball motion.
    if (pressed && pressed !== 'ultimate' && pressed !== 'special' && f.motion > 0 && f.y === 0) pressed = 'special';
    if (pressed) {
      f.buffered = { slot: pressed, frames: BUFFER_FRAMES };
      if (pressed === 'special') f.motion = 0;
    }
    // A pressed ultimate waits until the fighter is free; normal attacks expire.
    else if (f.buffered && f.buffered.slot !== 'ultimate' && --f.buffered.frames <= 0) f.buffered = null;

    fall(f);
    // Holding back on the ground while free means guarding; holding down too guards low.
    f.guard = !f.action && f.hitstun === 0 && f.y === 0 && back && !c.up ? (c.down ? 'low' : 'high') : null;

    if (f.hitstun > 0) {
      if (--f.hitstun === 0) f.knockedDown = false;
      return;
    }
    if (f.blockstun > 0) {
      f.blockstun--;
      return;
    }
    if (f.action) {
      advanceAction(state, i, f, o);
      return;
    }
    const airborne = f.y > 0;
    if (f.buffered && (f.buffered.slot !== 'ultimate' || f.meter >= METER_MAX)) {
      // In the air only the normal attacks work; specials and ultimates wait for the landing.
      const air = airborne && (f.buffered.slot === 'special' || f.buffered.slot === 'ultimate');
      if (!air) {
        startAction(state, i, f, f.buffered.slot, airborne ? 'air' : c.down ? 'crouch' : 'stand');
        f.buffered = null;
        return;
      }
    }
    if (airborne) return;
    f.crouching = c.down;
    if (c.up) {
      f.crouching = false;
      f.vy = JUMP_SPEED;
      f.vx = forward ? f.facing * JUMP_DRIFT : back ? -f.facing * JUMP_DRIFT : 0;
      f.y = 0.01;
      return;
    }
    if (f.crouching) return;
    const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    f.x += dir * walkSpeed(f.character) * (back ? BACK_WALK : 1);
  });

  const [a, b] = state.fighters;
  keepApart(a, b);
  // Fighters turn around only on the ground and when free, as in Street Fighter.
  if (!a.action && a.y === 0) a.facing = b.x >= a.x ? 1 : -1;
  if (!b.action && b.y === 0) b.facing = a.x >= b.x ? 1 : -1;

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

/** Gravity, air drift and landing. Runs every frame, also while hit or attacking. */
function fall(f: FighterState): void {
  if (f.y <= 0 && f.vy <= 0) return;
  f.y += f.vy;
  f.x += f.vx;
  f.vy -= GRAVITY;
  if (f.y <= 0) {
    f.y = 0;
    f.vy = 0;
    f.vx = 0;
    // Landing ends a jump attack.
    if (f.action?.stance === 'air') f.action = null;
  }
}

/** Follows the ↓ ↘ → motion, relative to where the fighter faces. */
function trackMotion(f: FighterState, down: boolean, forward: boolean): void {
  if (f.motion > 0) f.motion--;
  if (down && !forward) f.motionStep = 1;
  else if (down && forward && f.motionStep >= 1) f.motionStep = 2;
  else if (!down && forward && f.motionStep === 2) {
    f.motion = MOTION_WINDOW;
    f.motionStep = 0;
  } else if (!down) f.motionStep = 0;
}

function levelFor(slot: MoveSlot, stance: Stance): HitLevel {
  if (stance === 'air') return 'overhead';
  if (stance === 'crouch' && slot === 'kick') return 'low';
  return 'mid';
}

function startAction(state: FightState, i: number, f: FighterState, slot: MoveSlot, stance: Stance = 'stand'): void {
  const move = findMove(f.character.moves[slot]);
  if (!move) return;
  // Only normal attacks have crouching and jumping versions.
  if (slot === 'special' || slot === 'ultimate') stance = 'stand';
  const startup = startupFor(f.character, move);
  const active = activeFramesFor(move);
  f.crouching = stance === 'crouch';
  f.action = {
    slot,
    stance,
    level: levelFor(slot, stance),
    move,
    frame: 0,
    startup,
    active,
    total: startup + active + TIMING[slot].recovery,
    hitsLanded: 0,
  };
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
  // Rushing attacks carry the fighter forward until they connect.
  if (action.move.dashSpeed && isActive(f) && action.hitsLanded === 0) f.x += f.facing * action.move.dashSpeed;
  if (isActive(f) && landsHit(f, o, action)) {
    action.hitsLanded++;
    const move = action.move;
    const full = damageFor(f.character, o.character, move);
    const knockback = move.knockback ?? TIMING[action.slot].knockback;
    const hitstun = move.hitstun ?? TIMING[action.slot].hitstun;
    if (blocks(o, action.level)) {
      const chip = action.slot === 'special' || action.slot === 'ultimate' ? Math.max(1, Math.round(full * CHIP_SHARE)) : 0;
      o.hp = Math.max(0, o.hp - chip);
      o.blockstun = Math.round(hitstun * BLOCKSTUN_SHARE);
      o.x += (f.facing * knockback) / 2;
      o.meter = Math.min(METER_MAX, o.meter + full * METER_PER_DAMAGE_TAKEN * 0.5);
      state.events.push({ type: 'block', attacker: i, slot: action.slot, damage: chip });
    } else {
      o.hp = Math.max(0, o.hp - full);
      // A started ultimate cannot be interrupted, otherwise the spent bar would be lost.
      if (o.action?.slot !== 'ultimate') {
        const knockdown = action.level === 'low' || o.y > 0;
        o.hitstun = knockdown ? Math.max(hitstun, KNOCKDOWN_FRAMES) : hitstun;
        o.knockedDown = knockdown;
        o.action = null;
        o.crouching = false;
        o.blockstun = 0;
        o.x += f.facing * knockback;
        // Hit in the air: knocked out of the jump and back to the floor.
        if (o.y > 0) {
          o.vx = f.facing * 1.2;
          o.vy = Math.min(o.vy, 1.5);
        }
      }
      if (action.slot !== 'ultimate') f.meter = Math.min(METER_MAX, f.meter + full * METER_PER_DAMAGE_DEALT);
      o.meter = Math.min(METER_MAX, o.meter + full * METER_PER_DAMAGE_TAKEN);
      state.events.push({ type: 'hit', attacker: i, slot: action.slot, damage: full });
    }
  }
  if (action.frame >= action.total) f.action = null;
}

function blocks(o: FighterState, level: HitLevel): boolean {
  if (!o.guard) return false;
  if (level === 'low') return o.guard === 'low';
  if (level === 'overhead') return o.guard === 'high';
  return true;
}

/** Whether an attack from this height can reach the defender's height. */
function reachesHeight(f: FighterState, o: FighterState, a: Action): boolean {
  if (o.knockedDown) return false;
  if (a.stance === 'air') return Math.abs(f.y - o.y) <= 30;
  // The crouching heavy attack is an anti-air uppercut.
  if (a.stance === 'crouch' && a.slot === 'heavy') return true;
  if (a.stance === 'crouch') return o.y === 0;
  return o.y <= 20;
}

function landsHit(f: FighterState, o: FighterState, a: Action): boolean {
  const hits = a.move.hits ?? 1;
  if (a.hitsLanded >= hits) return false;
  if (o.knockedDown) return false;
  if (a.move.projectileSpeed) {
    // Projectiles can be jumped over.
    return Math.abs(projectileX(f)! - o.x) <= 10 && Math.abs(projectileLift(f) - o.y) <= 14;
  }
  if (!reachesHeight(f, o, a)) return false;
  // Combo moves get one hit window every ACTIVE_FRAMES frames.
  const window = Math.floor((a.frame - a.startup - 1) / ACTIVE_FRAMES);
  return window >= a.hitsLanded && inReach(f, o, a.slot);
}

const DASH_FRAMES = 12;

function activeFramesFor(move: Move): number {
  if (move.projectileSpeed) return Math.ceil((reachOf(move) - 12) / move.projectileSpeed);
  if (move.dashSpeed) return DASH_FRAMES;
  return ACTIVE_FRAMES * (move.hits ?? 1);
}

/** How high a lobbed projectile currently flies above its start, in pixels. */
export function projectileLift(f: FighterState): number {
  const a = f.action;
  if (!a?.move.arc || a.frame <= a.startup) return 0;
  const t = Math.min(1, (a.frame - a.startup) / a.active);
  return a.move.arc * 4 * t * (1 - t);
}

/** Where a thrown move's projectile currently is, or null for melee moves. */
export function projectileX(f: FighterState): number | null {
  const a = f.action;
  if (!a?.move.projectileSpeed || a.frame <= a.startup) return null;
  return f.x + f.facing * (12 + a.move.projectileSpeed * (a.frame - a.startup));
}

export function inReach(f: FighterState, o: FighterState, slot: MoveSlot): boolean {
  const dx = o.x - f.x;
  const move = f.action?.move;
  const reach = move && move.slot === slot ? reachOf(move) : TIMING[slot].reach;
  return Math.sign(dx) === f.facing && Math.abs(dx) <= reach;
}

/** True while an attack's hitbox is out, for drawing effects. */
export function isActive(f: FighterState): boolean {
  const a = f.action;
  return !!a && a.frame > a.startup && a.frame <= a.startup + a.active;
}

/** Reach of a move, or of a slot's default move. */
export function reachOf(moveOrSlot: Move | MoveSlot): number {
  return typeof moveOrSlot === 'string' ? TIMING[moveOrSlot].reach : (moveOrSlot.reach ?? TIMING[moveOrSlot.slot].reach);
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

/** How a computer opponent plays. */
export interface CpuProfile {
  /** Chance per frame to attack when in range. */
  aggression: number;
  /** Chance per frame to use the special move when it reaches. */
  specialChance: number;
  /** Chance to guard when the player attacks in reach. */
  blockChance?: number;
  /** Chance per frame to jump in from mid range. */
  jumpChance?: number;
}

export const DEFAULT_CPU: CpuProfile = { aggression: 0.08, specialChance: 0.015, blockChance: 0.35, jumpChance: 0.006 };

/** A simple computer opponent: walks in, attacks in range, blocks now and then and fires its ultimate when ready. */
export function cpuControls(state: FightState, i: number, random: () => number, profile: CpuProfile = DEFAULT_CPU): Controls {
  const f = state.fighters[i];
  const o = state.fighters[1 - i];
  const c: Controls = { ...NO_INPUT };
  if (state.winner !== null) return c;
  const dist = Math.abs(o.x - f.x);
  const toward: 'left' | 'right' = o.x > f.x ? 'right' : 'left';
  const away: 'left' | 'right' = toward === 'right' ? 'left' : 'right';

  // Guarding: decide once per incoming attack, then hold the guard while it lasts.
  const threat = o.action && o.action.frame <= o.action.startup + o.action.active && (dist <= reachOf(o.action.move) + 6 || o.action.move.projectileSpeed);
  if (threat && f.y === 0 && !f.action && f.hitstun === 0) {
    const decided = cpuGuards.get(o.action!);
    const guard = decided ?? random() < (profile.blockChance ?? DEFAULT_CPU.blockChance!);
    cpuGuards.set(o.action!, guard);
    if (guard) {
      c[away] = true;
      c.down = o.action!.level === 'low';
      return c;
    }
  }
  if (f.action || f.hitstun > 0 || f.blockstun > 0 || f.y > 0) return c;
  const move = (slot: MoveSlot): Move | undefined => findMove(f.character.moves[slot]);
  const reaches = (slot: MoveSlot): boolean => {
    const m = move(slot);
    return !!m && dist <= reachOf(m) - 4;
  };

  if (o.y > 12 && dist <= reachOf('heavy') + 8 && random() < 0.2) {
    // Anti-air: crouching heavy against a jump-in.
    c.down = true;
    c.heavy = true;
  } else if (canUseUltimate(f) && reaches('ultimate')) {
    c.ultimate = true;
  } else if (reaches('special') && random() < profile.specialChance) {
    c.special = true;
  } else if (dist <= reachOf('light')) {
    const r = random() / profile.aggression;
    if (r < 0.45) c.light = true;
    else if (r < 0.7) c.heavy = true;
    else if (r < 0.85) c.kick = true;
    else if (r < 1) {
      c.down = true;
      c.kick = true;
    } else if (r < 1.25) c[away] = true;
  } else if (dist > 50 && dist < 110 && random() < (profile.jumpChance ?? DEFAULT_CPU.jumpChance!)) {
    c.up = true;
    c[toward] = true;
  } else {
    c[toward] = random() < 0.9;
  }
  return c;
}

/** Whether the CPU chose to guard against a given attack, so it does not re-roll every frame. */
const cpuGuards = new WeakMap<Action, boolean>();
