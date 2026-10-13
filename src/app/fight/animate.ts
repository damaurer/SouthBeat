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

/** Guard up: fists in front of the chin, knees slightly bent, front foot forward. */
const GUARD = { armFront: 0.55, elbowFront: 1.95, armBack: 0.3, elbowBack: 1.75 };
/** The fighting stance, also used for still pictures of a fighter. */
export const STANCE = pose({ ...GUARD, lean: 0.05, legFront: 0.32, kneeFront: 0.25, legBack: -0.32, kneeBack: 0.2 });
const CROUCH = pose({ ...GUARD, y: 7, lean: 0.15, legFront: 1.25, kneeFront: 2.1, legBack: 0.45, kneeBack: 1.95 });
const JUMP_UP = pose({ armFront: 0.9, elbowFront: 1.6, armBack: 0.5, elbowBack: 1.4, legFront: 1.35, kneeFront: 2.2, legBack: 0.6, kneeBack: 1.9, lean: 0.05 });
const JUMP_DOWN = pose({ ...GUARD, legFront: 0.55, kneeFront: 0.7, legBack: -0.1, kneeBack: 0.4 });
const BLOCK_HIGH = pose({ armFront: 0.95, elbowFront: 2.35, armBack: 0.75, elbowBack: 2.3, lean: -0.12, x: -1, legFront: 0.35, kneeFront: 0.3, legBack: -0.4, kneeBack: 0.25 });
const BLOCK_LOW = pose({ ...CROUCH, armFront: 0.95, elbowFront: 2.35, armBack: 0.75, elbowBack: 2.3, lean: -0.05 });
const FALL_FRAMES = 9;
const GETUP_FRAMES = 14;
const LYING = pose({ roll: -Math.PI / 2, flatten: 0.85, armFront: 0.6, elbowFront: 0.6, armBack: -0.3, legFront: 0.25, kneeFront: 0.3, head: -0.2 });

interface Keys {
  wind: Pose;
  hit: Pose;
}

/** Wind-up and strike poses for each kind of attack. */
function keysFor(slot: MoveSlot, move: Move, stance: 'stand' | 'crouch' | 'air', step: number): Keys {
  const base = stance === 'crouch' ? CROUCH : stance === 'air' ? JUMP_DOWN : STANCE;
  const on = (p: Partial<Pose>): Pose => ({ ...base, ...p });
  const straight = (reach: number): Partial<Pose> => ({ armFront: 1.57, elbowFront: 0, reachFront: reach });
  if (stance === 'crouch') {
    if (slot === 'kick') {
      return {
        wind: on({ legFront: 1.4, kneeFront: 2.3, lean: 0.25 }),
        hit: on({ y: 9, legFront: 1.52, kneeFront: 0, legBack: 0.7, kneeBack: 2.2, lean: 0.35, armBack: -0.3, x: 1 }),
      };
    }
    if (slot === 'heavy') {
      return {
        wind: on({ armFront: 0.15, elbowFront: 1.1, y: 8 }),
        hit: on({ y: 0, armFront: 2.75, elbowFront: 0.3, reachFront: 2, lean: 0.05, legFront: 0.35, kneeFront: 0.2, legBack: -0.3, kneeBack: 0.2 }),
      };
    }
    return { wind: on({ armFront: 0.8, elbowFront: 1.6 }), hit: on({ ...straight(2), armFront: 1.45, x: 2 }) };
  }
  if (stance === 'air') {
    if (slot === 'light') return { wind: on({ armFront: 0.7, elbowFront: 1.8 }), hit: on({ armFront: 1.15, elbowFront: 0, reachFront: 2 }) };
    return {
      wind: on({ legFront: 1.3, kneeFront: 2.2, lean: -0.1 }),
      hit: on({ legFront: 1.0, kneeFront: 0, legBack: 0.5, kneeBack: 1.8, lean: 0.2 }),
    };
  }
  // Signature moves of the single-player opponents.
  switch (move.id) {
    case 'belly-bump':
      return {
        wind: on({ lean: 0.2, x: -2 }),
        hit: on({ lean: -0.3, x: 5, armFront: -0.5, elbowFront: 0.3, armBack: -0.7, elbowBack: 0.3, legFront: 0.5, kneeFront: 0.3 }),
      };
    case 'combo-flurry':
    case 'combo-chain':
      return step % 2 === 0
        ? { wind: on({ armFront: 0.6, elbowFront: 1.9 }), hit: on({ ...straight(3), lean: 0.15, x: 2 }) }
        : { wind: on({ armBack: 0.4, elbowBack: 1.8 }), hit: on({ armBack: 1.57, elbowBack: 0, reachBack: 4, armFront: 0.4, elbowFront: 2, lean: 0.2, x: 3 }) };
    case 'rack-slam':
      return {
        wind: on({ armFront: 2.9, elbowFront: 0.3, armBack: 2.8, elbowBack: 0.3, lean: -0.2, y: -1 }),
        hit: on({ armFront: 1.2, elbowFront: 0, armBack: 1.1, elbowBack: 0, reachFront: 3, lean: 0.3, x: 3 }),
      };
    case 'tomato-rain':
      return {
        wind: on({ armFront: 2.8, elbowFront: 0.2, armBack: 2.6, elbowBack: 0.2 }),
        hit: on({ armFront: step % 2 ? 2.4 : 1.4, elbowFront: 0.2, armBack: step % 2 ? 1.4 : 2.4, elbowBack: 0.2, lean: 0.05 }),
      };
  }
  switch (slot) {
    case 'light':
      return { wind: on({ armFront: 0.5, elbowFront: 2.2, lean: -0.03 }), hit: on({ ...straight(2), lean: 0.12, x: 2 }) };
    case 'heavy':
      return {
        wind: on({ armFront: -0.45, elbowFront: 1.9, lean: -0.18, x: -2, head: -0.1 }),
        hit: on({ ...straight(4), armFront: 1.65, armBack: 0.1, elbowBack: 1.6, lean: 0.3, x: 4, legBack: -0.55, kneeBack: 0.2, legFront: 0.5, kneeFront: 0.5 }),
      };
    case 'kick':
      return {
        wind: on({ legFront: 1.35, kneeFront: 2.3, lean: -0.1 }),
        hit: on({ legFront: 1.6, kneeFront: 0, legBack: -0.15, kneeBack: 0.1, lean: -0.32, armBack: -0.2, elbowBack: 1.2 }),
      };
    case 'special':
      if (move.projectileSpeed) {
        return {
          wind: on({ armFront: -2.2, elbowFront: 0.9, lean: -0.2, x: -1 }),
          hit: on({ ...straight(3), armFront: 1.5, lean: 0.25, x: 3, legBack: -0.45, kneeBack: 0.2, legFront: 0.45, kneeFront: 0.4 }),
        };
      }
      if (move.dashSpeed) {
        return {
          wind: on({ lean: -0.1 }),
          hit: on({ lean: 0.5, armFront: 1.4, elbowFront: 0.4, reachFront: 2, armBack: -0.8, elbowBack: 0.6, legBack: -0.8, kneeBack: 0.7, legFront: 0.7, kneeFront: 0.9, x: 3 }),
        };
      }
      return {
        wind: on({ armFront: 0.2, elbowFront: 1.4, armBack: -0.2, elbowBack: 1.4, lean: -0.15, x: -1 }),
        hit: on({ ...straight(3), armBack: 1.45, elbowBack: 0, reachBack: 4, lean: 0.25, x: 3 }),
      };
    case 'ultimate':
      return {
        wind: on({ armFront: 2.95, elbowFront: 0.1, armBack: 2.85, elbowBack: 0.1, lean: -0.12, y: -1, legFront: 0.4, kneeFront: 0.3, legBack: -0.4, kneeBack: 0.2 }),
        hit: on({ ...straight(4), armBack: 1.5, elbowBack: 0, reachBack: 6, lean: 0.22, x: 3, legFront: 0.5, kneeFront: 0.5, legBack: -0.55, kneeBack: 0.2 }),
      };
  }
}

const ease = (t: number): number => 1 - (1 - Math.max(0, Math.min(1, t))) ** 2;

export function poseFor(f: Animated, frame: number, outcome: Outcome = null): Pose {
  const airborne = (f.y ?? 0) > 0;
  if (f.knockedDown && !airborne) {
    // Falls backwards, lies there and gets back up when the hitstun runs out.
    if (f.hp > 0 && f.hitstun > 0 && f.hitstun <= GETUP_FRAMES) return blend(STANCE, LYING, f.hitstun / GETUP_FRAMES);
    const fall = blend(pose({ lean: -0.4, head: -0.4, armFront: 1.2, elbowFront: 0.4, armBack: 1.6, elbowBack: 0.4, legFront: 0.6, kneeFront: 0.6 }), LYING, ease(f.downFrames / FALL_FRAMES));
    return fall;
  }
  if (f.hitstun > 0) {
    // Snapped back by the hit; the head flicks and the arms fly loose.
    const shake = f.hitstun % 4 < 2 ? 1 : 0;
    const p = pose({ lean: -0.32, head: -0.35, armFront: -0.4, elbowFront: 0.7, armBack: -0.8, elbowBack: 0.5, x: -2 + shake, legFront: 0.4, kneeFront: 0.3, legBack: -0.15, kneeBack: 0.2 });
    if (airborne) return { ...p, legFront: 0.9, kneeFront: 1.2, legBack: 0.4, kneeBack: 1, lean: -0.6 };
    if (f.crouching) return { ...CROUCH, lean: -0.3, head: -0.35, armFront: -0.2, elbowFront: 0.8, armBack: -0.5, elbowBack: 0.6, x: -2 + shake };
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
    return pose({ armFront: 2.85, elbowFront: 0.4, armBack: 2.6, elbowBack: 0.4, y: hop, head: -0.15, legFront: 0.25, kneeFront: 0.2, legBack: -0.25, kneeBack: 0.1 });
  }
  if (outcome === 'lost' && f.hp <= 0) return LYING;
  if (f.crouching || f.guard === 'low') return CROUCH;
  if (f.walkFrames > 0) {
    // Legs swing in turn, the arms against them, and the body bobs with each step.
    const phase = f.walkFrames * 0.28;
    const s = Math.sin(phase);
    return {
      ...STANCE,
      legFront: s * 0.55,
      legBack: -s * 0.55,
      // The leg swinging forward lifts its foot.
      kneeFront: 0.2 + Math.max(0, Math.cos(phase)) * 0.7,
      kneeBack: 0.2 + Math.max(0, -Math.cos(phase)) * 0.7,
      armFront: STANCE.armFront - s * 0.15,
      armBack: STANCE.armBack + s * 0.15,
      y: Math.abs(s) < 0.3 ? -1 : 0,
    };
  }
  // Fighting stance with a slow breathing bob.
  const breath = Math.sin(frame * 0.09);
  return { ...STANCE, y: breath > 0.5 ? 1 : 0, kneeFront: STANCE.kneeFront + (breath > 0.5 ? 0.15 : 0), kneeBack: STANCE.kneeBack + (breath > 0.5 ? 0.15 : 0), elbowFront: STANCE.elbowFront + breath * 0.06 };
}
