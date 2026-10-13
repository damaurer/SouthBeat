import { Move, MoveSlot } from '../character/character.model';
import { Pose, blend, pose } from './pose';

/**
 * Picks a fighter's pose for the current frame: stance, walking, jumping, attacks with
 * wind-up, strike and recovery, getting hit, blocking, falling down and getting up.
 * Shared by the duel and the stage mode, so it only reads what both kinds of fighters have.
 */
export interface Animated {
  action: { slot: MoveSlot; move: Move; frame: number; startup: number; active: number; total: number; stance?: 'stand' | 'crouch' | 'air' } | null;
  hitstun: number;
  blockstun?: number;
  guard?: 'high' | 'low' | null;
  knockedDown: boolean;
  downFrames: number;
  walkFrames: number;
  crouching?: boolean;
  /** Height above the floor and vertical speed, in the duel. */
  y?: number;
  vy?: number;
  hp: number;
}

export type Outcome = 'won' | 'lost' | null;

const STANCE = pose({ armFront: 0.6, armBack: 0.35, lean: 0.06, legFront: 0.18, legBack: -0.18 });
const CROUCH = pose({ y: 9, armFront: 0.95, armBack: 0.6, lean: 0.12, legFront: 0.95, legBack: -0.95, legScale: 0.55 });
const JUMP_UP = pose({ armFront: 1.9, armBack: 1.3, legFront: 0.95, legBack: 0.35, legScale: 0.7, lean: 0.05 });
const JUMP_DOWN = pose({ armFront: 1.1, armBack: 0.6, legFront: 0.35, legBack: -0.2, legScale: 0.9 });
const BLOCK_HIGH = pose({ armFront: 2.0, armBack: 1.8, reachFront: -4, reachBack: -2, lean: -0.12, legFront: 0.25, legBack: -0.3, x: -1 });
const BLOCK_LOW = pose({ ...CROUCH, armFront: 1.9, armBack: 1.7, reachFront: -4, reachBack: -2, lean: -0.05 });
const FALL_FRAMES = 9;
const GETUP_FRAMES = 14;
const LYING = pose({ roll: -Math.PI / 2, flatten: 0.55, armFront: 0.4, armBack: -0.3, legFront: 0.2, head: -0.2 });

interface Keys {
  wind: Pose;
  hit: Pose;
}

/** Wind-up and strike poses for each kind of attack. */
function keysFor(slot: MoveSlot, move: Move, stance: 'stand' | 'crouch' | 'air', step: number): Keys {
  const base = stance === 'crouch' ? CROUCH : stance === 'air' ? JUMP_DOWN : STANCE;
  const on = (p: Partial<Pose>): Pose => ({ ...base, ...p });
  if (stance === 'crouch') {
    if (slot === 'kick') return { wind: on({ legFront: 0.6, lean: 0.25 }), hit: on({ legFront: 1.5, legScale: 0.85, lean: 0.35, armBack: -0.4, x: 2 }) };
    if (slot === 'heavy') return { wind: on({ armFront: 0.1, y: 10 }), hit: on({ y: 1, armFront: 2.9, reachFront: 3, lean: 0.05, legScale: 1, legFront: 0.3, legBack: -0.3 }) };
    return { wind: on({ armFront: 0.4 }), hit: on({ armFront: 1.45, reachFront: 3, x: 2 }) };
  }
  if (stance === 'air') {
    if (slot === 'light') return { wind: on({ armFront: 0.5 }), hit: on({ armFront: 1.2, reachFront: 3 }) };
    return { wind: on({ legFront: 0.3, legScale: 0.7, lean: -0.1 }), hit: on({ legFront: 0.85, legBack: -0.2, legScale: 1, lean: 0.25, armBack: 1.8 }) };
  }
  // Signature moves of the single-player opponents.
  switch (move.id) {
    case 'belly-bump':
      return { wind: on({ lean: 0.2, x: -2 }), hit: on({ lean: -0.3, x: 5, armFront: -0.5, armBack: -0.7, legFront: 0.4 }) };
    case 'combo-flurry':
    case 'combo-chain':
      return step % 2 === 0
        ? { wind: on({ armFront: 0.3 }), hit: on({ armFront: 1.6, reachFront: 4, armBack: 0.2, lean: 0.15, x: 2 }) }
        : { wind: on({ armBack: 0.3 }), hit: on({ armBack: 1.6, reachBack: 6, armFront: 0.2, lean: 0.2, x: 3 }) };
    case 'rack-slam':
      return { wind: on({ armFront: 3, armBack: 2.9, lean: -0.2, y: -1 }), hit: on({ armFront: 1.2, armBack: 1.1, reachFront: 3, lean: 0.3, x: 3 }) };
    case 'tomato-rain':
      return { wind: on({ armFront: 2.8, armBack: 2.6 }), hit: on({ armFront: step % 2 ? 2.4 : 1.4, armBack: step % 2 ? 1.4 : 2.4, lean: 0.05 }) };
  }
  switch (slot) {
    case 'light':
      return { wind: on({ armFront: 0.35, reachFront: -2, lean: -0.04 }), hit: on({ armFront: 1.57, reachFront: 4, lean: 0.14, x: 2, armBack: 0.25 }) };
    case 'heavy':
      return {
        wind: on({ armFront: -0.7, armBack: 0.9, lean: -0.18, x: -2, head: -0.1 }),
        hit: on({ armFront: 1.75, reachFront: 6, armBack: -0.5, lean: 0.3, x: 4, legBack: -0.45, legFront: 0.35 }),
      };
    case 'kick':
      return {
        wind: on({ legFront: 0.65, lean: -0.1, armBack: -0.2 }),
        hit: on({ legFront: 1.55, legBack: -0.12, lean: -0.32, armBack: -0.6, armFront: 1, x: 1 }),
      };
    case 'special':
      if (move.projectileSpeed) {
        return { wind: on({ armFront: -2.3, lean: -0.2, x: -1, armBack: 1 }), hit: on({ armFront: 1.5, reachFront: 4, lean: 0.25, armBack: -0.4, x: 3, legBack: -0.4 }) };
      }
      if (move.dashSpeed) {
        return { wind: on({ lean: -0.1, armFront: 0.2, armBack: -0.6 }), hit: on({ lean: 0.5, armFront: 1.45, reachFront: 4, armBack: -0.9, legBack: -0.7, legFront: 0.5, x: 3 }) };
      }
      return { wind: on({ armFront: 0.1, armBack: -0.3, lean: -0.15, x: -1 }), hit: on({ armFront: 1.6, armBack: 1.45, reachFront: 5, reachBack: 7, lean: 0.25, x: 3 }) };
    case 'ultimate':
      return {
        wind: on({ armFront: 2.95, armBack: 2.85, lean: -0.12, y: -1, legFront: 0.35, legBack: -0.35 }),
        hit: on({ armFront: 1.57, armBack: 1.5, reachFront: 5, reachBack: 7, lean: 0.22, x: 3, legFront: 0.45, legBack: -0.5 }),
      };
  }
}

const ease = (t: number): number => 1 - (1 - Math.max(0, Math.min(1, t))) ** 2;

export function poseFor(f: Animated, frame: number, outcome: Outcome = null): Pose {
  const airborne = (f.y ?? 0) > 0;
  if (f.knockedDown && !airborne) {
    // Falls backwards, lies there and gets back up when the hitstun runs out.
    if (f.hp > 0 && f.hitstun > 0 && f.hitstun <= GETUP_FRAMES) return blend(STANCE, LYING, f.hitstun / GETUP_FRAMES);
    const fall = blend(pose({ lean: -0.4, head: -0.4, armFront: 1.2, armBack: 1.6 }), LYING, ease(f.downFrames / FALL_FRAMES));
    return fall;
  }
  if (f.hitstun > 0) {
    // Snapped back by the hit; the head flicks and the arms fly loose.
    const shake = f.hitstun % 4 < 2 ? 1 : 0;
    const p = pose({ lean: -0.32, head: -0.35, armFront: -0.5, armBack: -0.9, x: -2 + shake, legFront: 0.3, legBack: -0.1 });
    if (airborne) return { ...p, legFront: 0.7, legBack: 0.3, legScale: 0.8, lean: -0.6 };
    if (f.crouching) return { ...CROUCH, lean: -0.3, head: -0.35, armFront: -0.3, armBack: -0.6, x: -2 + shake };
    return p;
  }
  if ((f.blockstun ?? 0) > 0) {
    const recoil = Math.min(1, (f.blockstun ?? 0) / 6);
    const p = f.guard === 'low' ? BLOCK_LOW : BLOCK_HIGH;
    return { ...p, x: p.x - recoil * 2 };
  }
  const a = f.action;
  if (a) {
    const stance = a.stance ?? 'stand';
    const step = Math.max(0, Math.floor((a.frame - a.startup - 1) / 4));
    const keys = keysFor(a.slot, a.move, stance, step);
    const rest = stance === 'crouch' ? CROUCH : stance === 'air' ? JUMP_DOWN : STANCE;
    if (a.frame <= a.startup) return blend(rest, keys.wind, ease(a.frame / Math.max(1, a.startup)));
    const into = a.frame - a.startup;
    if (into <= a.active) {
      // The strike snaps out in two frames, then holds; long moves ease off a little.
      const strike = blend(keys.wind, keys.hit, into / 2);
      return into > 14 ? blend(strike, rest, Math.min(0.4, (into - 14) / 20)) : strike;
    }
    const recovery = Math.max(1, a.total - a.startup - a.active);
    return blend(keys.hit, rest, ease((into - a.active) / recovery));
  }
  if (airborne) return (f.vy ?? 0) > 0.6 ? JUMP_UP : blend(JUMP_UP, JUMP_DOWN, ease(-(f.vy ?? 0) / 2));
  if (outcome === 'won') {
    const hop = Math.sin(frame * 0.2) > 0.3 ? -2 : 0;
    return pose({ armFront: 2.95, armBack: 2.9, y: hop, head: -0.15, legFront: 0.2, legBack: -0.2 });
  }
  if (outcome === 'lost' && f.hp <= 0) return LYING;
  if (f.crouching || f.guard === 'low') return CROUCH;
  if (f.walkFrames > 0) {
    // Legs swing in turn, the arms against them, and the body bobs with each step.
    const phase = f.walkFrames * 0.28;
    const s = Math.sin(phase);
    return {
      ...STANCE,
      legFront: STANCE.legFront + s * 0.5,
      legBack: STANCE.legBack - s * 0.5,
      armFront: STANCE.armFront - s * 0.2,
      armBack: STANCE.armBack + s * 0.25,
      y: Math.abs(Math.cos(phase)) > 0.8 ? -1 : 0,
    };
  }
  // Fighting stance with a slow breathing bob.
  const breath = Math.sin(frame * 0.09);
  return { ...STANCE, y: breath > 0.5 ? 1 : 0, armFront: STANCE.armFront + breath * 0.05, armBack: STANCE.armBack + breath * 0.04 };
}
