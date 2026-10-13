import { Injectable } from '@angular/core';
import { Controls, NO_INPUT } from '../fight/combat';

/** The buttons a player can press: on a gamepad, or on the touch controls. */
export type PadButton = 'left' | 'right' | 'up' | 'down' | 'light' | 'heavy' | 'kick' | 'special' | 'ultimate' | 'pause';

const ATTACKS = ['light', 'heavy', 'kick', 'special', 'ultimate'] as const;

/**
 * Standard gamepad layout (Xbox names): A light, B kick, X heavy, Y special,
 * RB or RT ultimate, Start pause. D-pad or left stick move.
 */
const BUTTONS: Partial<Record<PadButton, number[]>> = {
  light: [0],
  kick: [1],
  heavy: [2],
  special: [3],
  ultimate: [5, 7],
  pause: [9],
  up: [12],
  down: [13],
  left: [14],
  right: [15],
};
const STICK = 0.45;

/**
 * Gamepads and the touch controls. Gamepad 1 plays for player 1, gamepad 2 for player 2;
 * the touch controls play for player 1. Pages call poll() once per frame, then read
 * controls() and merge them with the keyboard.
 */
@Injectable({ providedIn: 'root' })
export class Pads {
  private held: Set<PadButton>[] = [new Set(), new Set()];
  private before: Set<PadButton>[] = [new Set(), new Set()];
  private readonly touch = new Set<PadButton>();
  private readonly touchTapped = new Set<PadButton>();

  /** Reads the gamepads; attack buttons count once per press. */
  poll(): void {
    this.before = this.held;
    this.held = [new Set(), new Set()];
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let player = 0;
    for (const pad of pads) {
      if (!pad || !pad.connected || player > 1) continue;
      const set = this.held[player++];
      for (const [button, indexes] of Object.entries(BUTTONS) as [PadButton, number[]][]) {
        if (indexes.some((i) => pad.buttons[i]?.pressed)) set.add(button);
      }
      const [x = 0, y = 0] = pad.axes;
      if (x < -STICK) set.add('left');
      if (x > STICK) set.add('right');
      if (y < -STICK) set.add('up');
      if (y > STICK) set.add('down');
    }
    this.touch.forEach((b) => this.held[0].add(b));
    this.touchTapped.forEach((b) => this.held[0].add(b));
  }

  /** Was the button pressed since the last poll (not just held)? */
  tapped(player: number, button: PadButton): boolean {
    return (this.held[player]?.has(button) && !this.before[player]?.has(button)) || (player === 0 && this.touchTapped.has(button));
  }

  /** Clears quick touch taps once a frame has used them. */
  consumed(): void {
    this.touchTapped.clear();
  }

  controls(player: number): Controls {
    const held = this.held[player];
    if (!held || held.size === 0) return NO_INPUT;
    const c: Controls = { ...NO_INPUT, left: held.has('left'), right: held.has('right'), up: held.has('up'), down: held.has('down') };
    for (const a of ATTACKS) c[a] = this.tapped(player, a);
    return c;
  }

  /** Touch controls: a finger goes down or up on a button. */
  press(button: PadButton): void {
    this.touch.add(button);
    this.touchTapped.add(button);
  }

  release(button: PadButton): void {
    this.touch.delete(button);
  }

  releaseAll(): void {
    this.touch.clear();
  }
}

/** Keyboard and pad together: held directions add up, a press on either counts. */
export function merge(a: Controls, b: Controls): Controls {
  return {
    left: a.left || b.left,
    right: a.right || b.right,
    up: a.up || b.up,
    down: a.down || b.down,
    light: a.light || b.light,
    heavy: a.heavy || b.heavy,
    kick: a.kick || b.kick,
    special: a.special || b.special,
    ultimate: a.ultimate || b.ultimate,
  };
}
