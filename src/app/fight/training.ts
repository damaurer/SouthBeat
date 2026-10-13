import { Painter } from '../arena/painter';
import { GROUND_Y } from '../arena/props';
import { MoveSlot } from '../character/character.model';
import { Controls, FPS, FightState, FighterState, METER_MAX, MatchRules, NO_INPUT, ROUND_FRAMES, isActive, projectileLift, projectileX, reachOf } from './combat';

/** Training has no intro, no rounds and no KO: the dummy gets back up and the clock never runs out. */
// A KO of one frame keeps the step from ending the round at once; the training step then calls it off.
export const TRAINING_RULES: MatchRules = { roundsToWin: 1, introFrames: 0, koFrames: 1 };

/** What the training dummy does. */
export type DummyMode = 'stand' | 'crouch' | 'jump' | 'block' | 'cpu';
export const DUMMY_MODES: DummyMode[] = ['stand', 'crouch', 'block', 'jump', 'cpu'];
export const DUMMY_LABELS: Record<DummyMode, string> = {
  stand: 'Steht',
  crouch: 'Duckt sich',
  block: 'Blockt alles',
  jump: 'Springt',
  cpu: 'Wehrt sich (CPU)',
};

export interface TrainingOptions {
  dummy: DummyMode;
  /** Keeps your action bar full, to try the ultimate again and again. */
  fullMeter: boolean;
}

/** Hits in a row while the dummy is still reeling, and their damage. */
export interface Combo {
  hits: number;
  damage: number;
  /** Frames the last combo stays on screen after it ended. */
  shown: number;
}

export const NO_COMBO: Combo = { hits: 0, damage: 0, shown: 0 };

/** How the dummy moves this frame; the CPU mode is handled by the page. */
export function dummyControls(state: FightState, mode: DummyMode): Controls {
  const d = state.fighters[1];
  const p = state.fighters[0];
  if (mode === 'crouch') return { ...NO_INPUT, down: true };
  if (mode === 'jump') return { ...NO_INPUT, up: d.y === 0 && state.frame % 40 === 0 };
  if (mode === 'block') {
    // Holds back, low against sweeps, standing against everything else.
    const away = p.x > d.x ? 'left' : 'right';
    return { ...NO_INPUT, [away]: true, down: p.action?.level === 'low' };
  }
  return NO_INPUT;
}

/**
 * Runs after each step: no one can lose, life fills up once a combo is over, the clock
 * loops and the combo counter keeps up. Returns the updated combo.
 */
export function afterTrainingStep(state: FightState, options: TrainingOptions, combo: Combo, dummyWasHit: boolean): Combo {
  state.roundWinner = null;
  state.ko = 0;
  if (state.frame >= ROUND_FRAMES - FPS) state.frame = FPS;
  state.fighters.forEach((f) => {
    f.hp = Math.max(1, f.hp);
    if (f.hitstun === 0 && f.blockstun === 0 && !f.knockedDown) f.hp = f.maxHp;
  });
  if (options.fullMeter) state.fighters[0].meter = METER_MAX;

  let next = { ...combo, shown: Math.max(0, combo.shown - 1) };
  for (const e of state.events) {
    if (e.type !== 'hit' || e.attacker !== 0) continue;
    // A hit on a dummy that is still reeling from the last one continues the combo.
    next = dummyWasHit ? { hits: next.hits + 1, damage: next.damage + e.damage, shown: 2 * FPS } : { hits: 1, damage: e.damage, shown: 2 * FPS };
  }
  return next;
}

/** True while the dummy is still reeling, so the next hit counts towards the combo. */
export function dummyReeling(state: FightState): boolean {
  const d = state.fighters[1];
  return d.hitstun > 0 || d.knockedDown;
}

const ARROWS: Record<string, string> = { '-1,-1': '↙', '0,-1': '↓', '1,-1': '↘', '-1,0': '←', '0,0': '', '1,0': '→', '-1,1': '↖', '0,1': '↑', '1,1': '↗' };
const BUTTONS: Record<MoveSlot, string> = { light: 'L', heavy: 'S', kick: 'T', special: 'Sp', ultimate: 'U' };

/**
 * The input display: one entry per change, written as the fighting-game notation with
 * arrows seen from the fighter (→ is always forward), plus the attack buttons.
 */
export function inputEntry(f: FighterState, c: Controls): string {
  const forward = f.facing === 1 ? c.right : c.left;
  const back = f.facing === 1 ? c.left : c.right;
  const arrow = ARROWS[`${(forward ? 1 : 0) - (back ? 1 : 0)},${(c.up ? 1 : 0) - (c.down ? 1 : 0)}`];
  const buttons = (Object.keys(BUTTONS) as MoveSlot[]).filter((s) => c[s]).map((s) => BUTTONS[s]);
  return [arrow, ...buttons].filter(Boolean).join('+');
}

/** Adds an input to the log when it differs from the last one; keeps the newest few. */
export function logInput(log: readonly string[], entry: string, last: string): string[] {
  if (entry === last || entry === '') return [...log];
  return [entry, ...log].slice(0, 12);
}

const HURT = '#2ecc71';
const HIT = '#e74c3c';
const STARTUP = '#f1c40f';

/** Draws where each fighter can be hit (green) and where their attack reaches (yellow while starting, red while it hits). */
export function drawBoxes(p: Painter, state: FightState): void {
  for (const f of state.fighters) {
    const x = Math.round(f.x);
    const top = GROUND_Y - Math.round(f.y) - (f.crouching || f.knockedDown ? 24 : 40);
    p.frame(x - 6, top, 13, GROUND_Y - Math.round(f.y) - top, HURT);
    const a = f.action;
    if (!a || a.frame > a.startup + a.active) continue;
    const color = isActive(f) ? HIT : STARTUP;
    const px = projectileX(f);
    if (px !== null) {
      p.frame(Math.round(px) - 10, GROUND_Y - 30 - Math.round(projectileLift(f)) - 14, 21, 28, color);
      continue;
    }
    if (a.move.projectileSpeed) continue;
    const reach = reachOf(a.move);
    const y = a.level === 'low' ? GROUND_Y - 16 : GROUND_Y - 36 - Math.round(f.y);
    const left = f.facing === 1 ? x : x - reach;
    p.frame(left, y, reach + 1, 12, color);
  }
}
