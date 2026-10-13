import { MoveSlot } from '../character/character.model';

export interface KeyMap {
  up: string;
  left: string;
  down: string;
  right: string;
  light: string;
  heavy: string;
  kick: string;
  special: string;
  ultimate: string;
}

/**
 * Player 1 uses WASD and J K L Ö Ä on a German keyboard (Ö and Ä sit where US layouts
 * have ; and ', which is what KeyboardEvent.code reports). Player 2 uses the arrow keys and
 * the number pad. Up and down are reserved for jumping and ducking.
 */
export const KEYS: [KeyMap, KeyMap] = [
  { up: 'KeyW', left: 'KeyA', down: 'KeyS', right: 'KeyD', light: 'KeyJ', heavy: 'KeyK', kick: 'KeyL', special: 'Semicolon', ultimate: 'Quote' },
  { up: 'ArrowUp', left: 'ArrowLeft', down: 'ArrowDown', right: 'ArrowRight', light: 'Numpad1', heavy: 'Numpad2', kick: 'Numpad3', special: 'Numpad4', ultimate: 'Numpad5' },
];

export const GAME_KEYS = new Set(KEYS.flatMap((k) => Object.values(k)));

export const ATTACK_SLOTS: readonly MoveSlot[] = ['light', 'heavy', 'kick', 'special', 'ultimate'];

const KEY_NAMES: Record<string, string> = {
  Semicolon: 'Ö',
  Quote: 'Ä',
  BracketLeft: 'Ü',
  Space: 'Leertaste',
  Enter: 'Enter',
  ShiftLeft: 'Shift links',
  ShiftRight: 'Shift rechts',
  ControlLeft: 'Strg links',
  ControlRight: 'Strg rechts',
  AltLeft: 'Alt',
  AltRight: 'Alt Gr',
  Backspace: '⌫',
  Tab: 'Tab',
  NumpadEnter: 'Num Enter',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

export function keyName(code: string): string {
  return KEY_NAMES[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
}
