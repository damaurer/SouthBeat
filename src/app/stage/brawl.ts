import { Character, Move, MoveSlot, findMove } from '../character/character.model';
import { Controls, CpuProfile, DEFAULT_CPU, FPS, METER_MAX, damageFor, maxHpFor, reachOf, startupFor, walkSpeed } from '../fight/combat';
import { ItemKind, SEGMENTS_PER_STAGE, SEGMENT_WIDTH, StageDef, WORLD_WIDTH, makeGrunt } from './stages';

/**
 * Rules for the co-op stage mode, a side-scrolling brawler in the style of Final Fight:
 * fighters walk left, right and into the depth of the floor (z), and attacks only connect
 * with enemies on about the same depth. One call to `stepStage` is one frame.
 */

/** How deep the walkable floor is, in pixels; 0 is the front edge. */
export const DEPTH = 28;
/** Attacks hit targets this close in depth. */
const DEPTH_REACH = 7;
const SCREEN = SEGMENT_WIDTH;
const LIVES = 3;
const RESPAWN_FRAMES = 90;
const INVULNERABLE_FRAMES = 120;
const CORPSE_FRAMES = 50;
const METER_PER_FRAME = METER_MAX / (40 * FPS);

const TIMING: Record<MoveSlot, { recovery: number; hitstun: number; knockback: number }> = {
  light: { recovery: 8, hitstun: 14, knockback: 3 },
  heavy: { recovery: 16, hitstun: 22, knockback: 8 },
  kick: { recovery: 12, hitstun: 18, knockback: 10 },
  special: { recovery: 18, hitstun: 20, knockback: 6 },
  ultimate: { recovery: 24, hitstun: 45, knockback: 22 },
};

export type Team = 'player' | 'enemy';
export type Brain = 'human' | 'ally' | 'grunt' | 'boss';

export interface BrawlAction {
  slot: MoveSlot;
  move: Move;
  frame: number;
  startup: number;
  active: number;
  total: number;
  /** Hits landed per target id, for combo moves with several hits. */
  landed: Record<number, number>;
  thrown: boolean;
}

export interface Brawler {
  id: number;
  team: Team;
  brain: Brain;
  /** 0 or 1 for players and their CPU partner. */
  player: 0 | 1 | null;
  name: string;
  /** Enemy type from stages.ts, for enemies of the waves. */
  kind: string | null;
  character: Character;
  cpu: CpuProfile;
  speed: number;
  x: number;
  z: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  meter: number;
  action: BrawlAction | null;
  hitstun: number;
  knockedDown: boolean;
  invulnerable: number;
  weapon: { kind: 'keyboard'; uses: number } | null;
  /** Light hits and kicks don't interrupt it. */
  armor: boolean;
  lives: number;
  /** Frames until a knocked-out player comes back, or a beaten enemy disappears. */
  downFor: number;
  out: boolean;
  /** AI: frames until it may attack again. */
  cooldown: number;
}

export interface Projectile {
  owner: number;
  team: Team;
  move: Move;
  character: Character;
  x: number;
  z: number;
  dir: 1 | -1;
  travelled: number;
  range: number;
  damage: number;
}

export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  z: number;
}

export type StageEvent =
  | { type: 'hit'; attacker: number; target: number; slot: MoveSlot; damage: number; armored?: boolean }
  | { type: 'ko'; target: number }
  | { type: 'pickup'; who: number; kind: ItemKind }
  | { type: 'ultimate'; who: number; move: Move }
  | { type: 'wave' }
  | { type: 'go' }
  | { type: 'boss'; who: number };

export type StagePhase = 'fight' | 'go' | 'cleared' | 'gameover';

export interface StageState {
  stage: StageDef;
  frame: number;
  phase: StagePhase;
  /** Left edge of the visible screen in world pixels. */
  cameraX: number;
  segment: number;
  wave: number;
  /** Enemies of the current wave are still on their way in. */
  brawlers: Brawler[];
  projectiles: Projectile[];
  items: Item[];
  events: StageEvent[];
  nextId: number;
  bossId: number | null;
}

export interface StagePlayer {
  character: Character;
  brain: 'human' | 'ally';
}

export function createStage(stage: StageDef, players: StagePlayer[], carry?: Brawler[]): StageState {
  const state: StageState = {
    stage,
    frame: 0,
    phase: 'fight',
    cameraX: 0,
    segment: 0,
    wave: 0,
    brawlers: [],
    projectiles: [],
    items: stage.items.map((it, i) => ({ id: 1000 + i, ...it })),
    events: [],
    nextId: 1,
    bossId: null,
  };
  players.forEach((p, i) => {
    const b = brawler(state, 'player', p.brain, p.character, maxHpFor(p.character), DEFAULT_CPU, 1);
    b.player = i as 0 | 1;
    b.x = 40 + i * 24;
    b.z = 8 + i * 12;
    // Lives and the action bar carry over from the previous stage.
    const before = carry?.find((c) => c.player === i);
    if (before) {
      b.lives = before.out ? 1 : before.lives;
      b.meter = before.meter;
    }
    state.brawlers.push(b);
  });
  spawnWave(state);
  return state;
}

function brawler(state: StageState, team: Team, brain: Brain, character: Character, hp: number, cpu: CpuProfile, speed: number): Brawler {
  return {
    id: state.nextId++,
    team,
    brain,
    player: null,
    name: character.name,
    kind: null,
    character,
    cpu,
    speed,
    x: 0,
    z: 0,
    facing: 1,
    hp,
    maxHp: hp,
    meter: 0,
    action: null,
    hitstun: 0,
    knockedDown: false,
    invulnerable: 0,
    weapon: null,
    armor: false,
    lives: LIVES,
    downFor: 0,
    out: false,
    cooldown: 30,
  };
}

const segmentLeft = (seg: number): number => seg * SEGMENT_WIDTH;
const lastSegment = SEGMENTS_PER_STAGE - 1;

function spawnWave(state: StageState): void {
  const waves = state.stage.waves[state.segment];
  const kinds = waves[state.wave] ?? [];
  const left = state.cameraX;
  kinds.forEach((kind, i) => {
    const g = makeGrunt(kind, state.stage.index * 100 + state.segment * 10 + state.wave * 3 + i);
    // Later stages hit a little harder.
    const hp = Math.round(g.hp * (1 + state.stage.index * 0.15));
    const b = brawler(state, 'enemy', 'grunt', g.character, hp, g.cpu, g.speed);
    b.kind = g.kind;
    b.armor = g.armor;
    const fromRight = i % 2 === 0;
    b.x = fromRight ? left + SCREEN + 12 + i * 14 : left - 12 - i * 14;
    b.z = (i * 11) % (DEPTH + 1);
    b.facing = fromRight ? -1 : 1;
    b.cooldown = 40 + i * 15;
    state.brawlers.push(b);
  });
  if (state.segment === lastSegment && state.wave === 0) {
    const o = state.stage.boss;
    const hp = Math.round(maxHpFor(o.character) * 1.6);
    const boss = brawler(state, 'enemy', 'boss', o.character, hp, o.cpu, 1);
    boss.x = left + SCREEN - 30;
    boss.z = DEPTH / 2;
    boss.facing = -1;
    boss.cooldown = 90;
    state.brawlers.push(boss);
    state.bossId = boss.id;
    state.events.push({ type: 'boss', who: boss.id });
  }
  state.events.push({ type: 'wave' });
}

export function stepStage(state: StageState, controls: Controls[], random: () => number): void {
  state.events = [];
  if (state.phase === 'cleared' || state.phase === 'gameover') return;
  state.frame++;
  const players = state.brawlers.filter((b) => b.team === 'player');

  for (const b of state.brawlers) {
    if (b.invulnerable > 0) b.invulnerable--;
    if (b.out) continue;
    if (b.hp <= 0) {
      downed(state, b);
      continue;
    }
    b.meter = Math.min(METER_MAX, b.meter + METER_PER_FRAME);
    if (b.hitstun > 0) {
      if (--b.hitstun === 0) b.knockedDown = false;
      continue;
    }
    if (b.action) {
      advance(state, b);
      continue;
    }
    const c = b.brain === 'human' ? controls[b.player ?? 0] ?? NO_CONTROLS : think(state, b, random);
    act(state, b, c);
  }

  moveProjectiles(state);
  pickUp(state);
  keepOnScreen(state);
  progress(state, players);
}

const NO_CONTROLS: Controls = { left: false, right: false, up: false, down: false, light: false, heavy: false, kick: false, special: false, ultimate: false };

function act(state: StageState, b: Brawler, c: Controls): void {
  const slot: MoveSlot | null = c.ultimate && b.meter >= METER_MAX ? 'ultimate' : c.heavy ? 'heavy' : c.kick ? 'kick' : c.special ? 'special' : c.light ? 'light' : null;
  if (slot) {
    start(state, b, slot);
    return;
  }
  const dx = (c.right ? 1 : 0) - (c.left ? 1 : 0);
  // Up walks into the depth of the floor, down towards the front.
  const dz = (c.up ? 1 : 0) - (c.down ? 1 : 0);
  const speed = walkSpeed(b.character) * b.speed;
  b.x += dx * speed;
  b.z = Math.max(0, Math.min(DEPTH, b.z + dz * speed * 0.6));
  if (dx !== 0) b.facing = dx > 0 ? 1 : -1;
}

function start(state: StageState, b: Brawler, slot: MoveSlot): void {
  const move = findMove(b.character.moves[slot]);
  if (!move) return;
  const startup = startupFor(b.character, move);
  const active = move.dashSpeed ? 12 : 4 * (move.hits ?? 1);
  b.action = { slot, move, frame: 0, startup, active, total: startup + active + TIMING[slot].recovery, landed: {}, thrown: false };
  if (slot === 'ultimate') {
    b.meter = 0;
    state.events.push({ type: 'ultimate', who: b.id, move });
  }
}

function advance(state: StageState, b: Brawler): void {
  const a = b.action!;
  a.frame++;
  const active = a.frame > a.startup && a.frame <= a.startup + a.active;
  if (active && a.move.projectileSpeed && a.slot !== 'ultimate') {
    if (!a.thrown) {
      a.thrown = true;
      // Moves with several shots fan them out over the depth of the floor.
      const shots = a.move.shots ?? 1;
      for (let i = 0; i < shots; i++) {
        const spread = shots === 1 ? 0 : (i - (shots - 1) / 2) * 9;
        state.projectiles.push({
          owner: b.id,
          team: b.team,
          move: a.move,
          character: b.character,
          x: b.x + b.facing * (12 + i * 4),
          z: Math.max(0, Math.min(DEPTH, b.z + spread)),
          dir: b.facing,
          travelled: 0,
          range: reachOf(a.move) * 1.4,
          damage: 0,
        });
      }
    }
  } else if (active) {
    if (a.move.dashSpeed && Object.keys(a.landed).length === 0) b.x += b.facing * a.move.dashSpeed;
    const ultimate = a.slot === 'ultimate';
    const reach = ultimate ? reachOf(a.move) + 30 : reachOf(a.move) + (b.weapon && a.slot !== 'special' ? 8 : 0);
    const depth = ultimate ? DEPTH : DEPTH_REACH;
    const hits = a.move.hits ?? 1;
    const window = Math.floor((a.frame - a.startup - 1) / 4);
    for (const t of targets(state, b)) {
      const dx = (t.x - b.x) * b.facing;
      if (dx < -4 || dx > reach || Math.abs(t.z - b.z) > depth) continue;
      const landed = a.landed[t.id] ?? 0;
      if (landed >= hits || (hits > 1 && window < landed)) continue;
      a.landed[t.id] = landed + 1;
      strike(state, b, t, a.slot, a.move);
    }
  }
  if (a.frame >= a.total) b.action = null;
}

function targets(state: StageState, b: Brawler): Brawler[] {
  return state.brawlers.filter((t) => t.team !== b.team && !t.out && t.hp > 0 && !t.knockedDown && t.invulnerable === 0);
}

function strike(state: StageState, from: Brawler, to: Brawler, slot: MoveSlot, move: Move): void {
  let damage = damageFor(from.character, to.character, move);
  // Grunts are made to go down fast; bosses take a bit less from ultimates.
  if (from.weapon && slot !== 'special' && slot !== 'ultimate') {
    damage = Math.round(damage * 1.6);
    if (--from.weapon.uses <= 0) from.weapon = null;
  }
  to.hp = Math.max(0, to.hp - damage);
  const t = TIMING[slot];
  if (to.armor && (slot === 'light' || slot === 'kick') && to.hp > 0) {
    // Armored enemies take the damage but keep going.
    from.meter = Math.min(METER_MAX, from.meter + damage * 1.2);
    state.events.push({ type: 'hit', attacker: from.id, target: to.id, slot, damage, armored: true });
    return;
  }
  const knockdown = slot === 'kick' || slot === 'ultimate' || to.hp === 0;
  to.hitstun = move.hitstun ?? (knockdown ? Math.max(t.hitstun, 40) : t.hitstun);
  to.knockedDown = knockdown;
  to.action = to.brain === 'boss' && to.action?.slot === 'ultimate' ? to.action : null;
  to.x += from.facing * (move.knockback ?? t.knockback);
  to.facing = from.facing === 1 ? -1 : 1;
  if (slot !== 'ultimate') from.meter = Math.min(METER_MAX, from.meter + damage * 1.2);
  to.meter = Math.min(METER_MAX, to.meter + damage * 0.8);
  state.events.push({ type: 'hit', attacker: from.id, target: to.id, slot, damage });
  if (to.hp === 0) state.events.push({ type: 'ko', target: to.id });
}

function moveProjectiles(state: StageState): void {
  state.projectiles = state.projectiles.filter((p) => {
    const speed = p.move.projectileSpeed ?? 4;
    p.x += p.dir * speed;
    p.travelled += speed;
    const owner = state.brawlers.find((b) => b.id === p.owner);
    for (const t of state.brawlers) {
      if (t.team === p.team || t.out || t.hp <= 0 || t.knockedDown || t.invulnerable > 0) continue;
      if (Math.abs(t.x - p.x) <= 9 && Math.abs(t.z - p.z) <= DEPTH_REACH) {
        if (owner) strike(state, owner, t, 'special', p.move);
        return false;
      }
    }
    return p.travelled < p.range && p.x > -40 && p.x < WORLD_WIDTH + 40;
  });
}

function pickUp(state: StageState): void {
  for (const b of state.brawlers) {
    if (b.team !== 'player' || b.out || b.hp <= 0 || b.action || b.hitstun) continue;
    for (const item of state.items) {
      if (Math.abs(item.x - b.x) > 10 || Math.abs(item.z - b.z) > 6) continue;
      if (item.kind === 'keyboard') {
        if (b.weapon) continue;
        b.weapon = { kind: 'keyboard', uses: 10 };
      } else {
        if (b.hp >= b.maxHp) continue;
        b.hp = Math.min(b.maxHp, b.hp + (item.kind === 'pizza' ? 50 : 20));
      }
      state.items = state.items.filter((i) => i !== item);
      state.events.push({ type: 'pickup', who: b.id, kind: item.kind });
      break;
    }
  }
}

/** Beaten fighters: enemies fade away, players lose a life and come back. */
function downed(state: StageState, b: Brawler): void {
  if (b.downFor === 0) {
    b.downFor = b.team === 'enemy' ? CORPSE_FRAMES : RESPAWN_FRAMES;
    b.knockedDown = true;
    b.action = null;
    return;
  }
  if (--b.downFor > 0) return;
  if (b.team === 'enemy') {
    b.out = true;
    // Now and then a beaten enemy leaves a coffee behind.
    if (b.brain === 'grunt' && (b.id * 7) % 5 === 0) state.items.push({ id: state.nextId++, kind: 'coffee', x: b.x, z: b.z });
    return;
  }
  b.lives--;
  if (b.lives <= 0) {
    b.out = true;
    return;
  }
  b.hp = b.maxHp;
  b.knockedDown = false;
  b.hitstun = 0;
  b.invulnerable = INVULNERABLE_FRAMES;
  b.x = state.cameraX + 40;
  b.weapon = null;
}

function keepOnScreen(state: StageState): void {
  const left = state.cameraX + 8;
  const right = state.cameraX + SCREEN - 8;
  for (const b of state.brawlers) {
    if (b.out) continue;
    if (b.team === 'player') b.x = Math.max(left, Math.min(right, b.x));
    else b.x = Math.max(-40, Math.min(WORLD_WIDTH + 40, b.x));
  }
}

/** Waves, camera and the end of the stage. */
function progress(state: StageState, players: Brawler[]): void {
  const alive = players.filter((p) => !p.out);
  if (alive.length === 0) {
    state.phase = 'gameover';
    return;
  }
  const enemiesLeft = state.brawlers.some((b) => b.team === 'enemy' && !b.out);
  if (state.phase === 'fight') {
    if (enemiesLeft) return;
    const boss = state.brawlers.find((b) => b.id === state.bossId);
    if (boss?.out) {
      state.phase = 'cleared';
      return;
    }
    if (state.wave + 1 < state.stage.waves[state.segment].length) {
      state.wave++;
      spawnWave(state);
      return;
    }
    state.phase = 'go';
    state.events.push({ type: 'go' });
    return;
  }
  // 'go': the camera follows the players to the next segment, then locks there.
  const lead = Math.max(...alive.map((p) => p.x));
  const target = Math.min(segmentLeft(state.segment + 1), lead - SCREEN / 2);
  if (target > state.cameraX) state.cameraX = Math.min(target, state.cameraX + 2);
  if (state.cameraX >= segmentLeft(state.segment + 1)) {
    state.cameraX = segmentLeft(state.segment + 1);
    state.segment++;
    state.wave = 0;
    state.phase = 'fight';
    // Players left behind are pulled onto the new screen.
    for (const p of alive) p.x = Math.max(p.x, state.cameraX + 12);
    spawnWave(state);
  }
}

/** Computer control for enemies, bosses and a CPU partner. */
function think(state: StageState, b: Brawler, random: () => number): Controls {
  const c: Controls = { ...NO_CONTROLS };
  const foes = targets(state, b);
  if (foes.length === 0) {
    // A partner without enemies around keeps up with the human player.
    if (b.brain === 'ally') {
      const lead = state.brawlers.find((p) => p.brain === 'human' && !p.out);
      if (lead && Math.abs(lead.x - b.x) > 40) c[lead.x > b.x ? 'right' : 'left'] = true;
      if (state.phase === 'go' && !lead) c.right = true;
    }
    return c;
  }
  const t = foes.reduce((best, f) => (Math.abs(f.x - b.x) + Math.abs(f.z - b.z) * 2 < Math.abs(best.x - b.x) + Math.abs(best.z - b.z) * 2 ? f : best));
  const dx = t.x - b.x;
  const dz = t.z - b.z;
  const light = reachOf(findMove(b.character.moves.light) ?? 'light');
  // Enemies stay on their side of the player instead of crowding one spot.
  const side = b.team === 'enemy' ? (b.x >= t.x ? 1 : -1) : -Math.sign(dx) || -1;
  const wantX = t.x + side * (light - 8);
  if (Math.abs(dz) > 3) c[dz > 0 ? 'up' : 'down'] = true;
  if (Math.abs(wantX - b.x) > 3) c[wantX > b.x ? 'right' : 'left'] = true;
  if (b.cooldown > 0) {
    b.cooldown--;
    return c;
  }
  const lined = Math.abs(dz) <= 4;
  b.facing = dx >= 0 ? 1 : -1;
  const special = findMove(b.character.moves.special);
  if (b.brain !== 'grunt' && lined && b.meter >= METER_MAX && Math.abs(dx) < reachOf(findMove(b.character.moves.ultimate) ?? 'ultimate')) {
    return { ...NO_CONTROLS, ultimate: true };
  }
  if (lined && special && Math.abs(dx) <= reachOf(special) && random() < b.cpu.specialChance * (b.brain === 'ally' ? 3 : 2)) {
    b.cooldown = 30;
    return { ...NO_CONTROLS, special: true };
  }
  if (lined && Math.abs(dx) <= light + 2) {
    const aggression = b.brain === 'ally' ? 0.12 : b.cpu.aggression;
    const r = random() / aggression;
    b.cooldown = b.brain === 'grunt' ? 25 + Math.floor(random() * 30) : 10;
    if (r < 0.5) return { ...NO_CONTROLS, light: true };
    if (r < 0.75) return { ...NO_CONTROLS, heavy: true };
    if (r < 1) return { ...NO_CONTROLS, kick: true };
  }
  return c;
}
