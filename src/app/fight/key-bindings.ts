import { Injectable, computed, signal } from '@angular/core';
import { KEYS, KeyMap, keyName } from './controls';

export type KeyAction = keyof KeyMap;

export const KEY_ACTIONS: readonly KeyAction[] = ['up', 'left', 'down', 'right', 'light', 'heavy', 'kick', 'special', 'ultimate'];

export const KEY_ACTION_LABELS: Record<KeyAction, string> = {
  up: 'Springen',
  left: 'Links',
  down: 'Ducken',
  right: 'Rechts',
  light: 'Leichter Schlag',
  heavy: 'Schwerer Schlag',
  kick: 'Tritt',
  special: 'Spezialangriff',
  ultimate: 'Ultimate',
};

const STORAGE_KEY = 'southbeat.keys';

interface Stored {
  keys: [KeyMap, KeyMap];
  /** What the key showed when it was bound, so labels match the keyboard layout (QWERTZ shows Z, not Y). */
  labels: Record<string, string>;
}

/** What happened when a key was bound: if it was already in use, the two bindings swapped. */
export interface BindResult {
  swappedWith: { player: 0 | 1; action: KeyAction } | null;
}

/**
 * Key bindings for both players, saved in this browser. Every PC keeps its own,
 * so in online fights each player uses whatever they set up on their machine.
 */
@Injectable({ providedIn: 'root' })
export class KeyBindings {
  private readonly stored = signal<Stored>(load());
  readonly keys = computed(() => this.stored().keys);
  private readonly codes = computed(() => new Set(this.keys().flatMap((k) => Object.values(k))));

  isGameKey(code: string): boolean {
    return this.codes().has(code);
  }

  name(code: string): string {
    return this.stored().labels[code] ?? keyName(code);
  }

  bind(player: 0 | 1, action: KeyAction, code: string, label: string): BindResult {
    const { keys, labels } = this.stored();
    const next: [KeyMap, KeyMap] = [{ ...keys[0] }, { ...keys[1] }];
    let swappedWith: BindResult['swappedWith'] = null;
    const old = next[player][action];
    for (const p of [0, 1] as const) {
      for (const a of KEY_ACTIONS) {
        if (next[p][a] === code && !(p === player && a === action)) {
          next[p][a] = old;
          swappedWith = { player: p, action: a };
        }
      }
    }
    next[player][action] = code;
    this.save({ keys: next, labels: { ...labels, [code]: label } });
    return { swappedWith };
  }

  reset(player: 0 | 1): void {
    const keys = [...this.keys()] as [KeyMap, KeyMap];
    keys[player] = { ...KEYS[player] };
    this.save({ keys, labels: this.stored().labels });
  }

  private save(value: Stored): void {
    this.stored.set(value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Without storage the bindings still work until the page is reloaded.
    }
  }
}

/** Turns a pressed key into a label for the screen. */
export function labelFor(e: Pick<KeyboardEvent, 'key' | 'code'>): string {
  if (e.key === ' ') return 'Leertaste';
  if (e.key.length === 1) return e.key.toUpperCase();
  return keyName(e.code);
}

function load(): Stored {
  const defaults: Stored = { keys: [{ ...KEYS[0] }, { ...KEYS[1] }], labels: {} };
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    const valid = (k: unknown): k is KeyMap =>
      !!k && typeof k === 'object' && KEY_ACTIONS.every((a) => typeof (k as Record<string, unknown>)[a] === 'string');
    if (!Array.isArray(parsed.keys) || !valid(parsed.keys[0]) || !valid(parsed.keys[1])) return defaults;
    const labels = parsed.labels && typeof parsed.labels === 'object' ? parsed.labels : {};
    return { keys: [parsed.keys[0], parsed.keys[1]], labels };
  } catch {
    return defaults;
  }
}
