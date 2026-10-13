import { Component, DestroyRef, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CharacterStore } from '../character/character-store';
import { STAT_KEYS, STAT_LABELS } from '../character/character.model';
import { KEYS, keyName } from '../fight/controls';
import { FighterPortrait } from './fighter-portrait';
import { RANDOM_FIGHTER, RosterEntry, roster } from './roster';

export type OpponentMode = 'cpu' | 'local';

export interface FighterPicks {
  p1: string;
  /** Null when only one player picks, as in online fights. */
  p2: string | null;
  mode: OpponentMode;
}

/** Tiles per row; the cursors move through the grid like on a fighting game select screen. */
const COLUMNS = 4;

interface Tile {
  id: string;
  entry: RosterEntry | null;
}

/**
 * Character select in the style of a classic fighting game: a grid of portraits on top,
 * one panel per player below. Each player moves their own cursor with their keys
 * (or clicks), picks with their light attack key and goes back with their heavy attack key.
 */
@Component({
  selector: 'app-character-select',
  imports: [FighterPortrait, RouterLink],
  templateUrl: './character-select.html',
  styleUrl: './character-select.scss',
})
export class CharacterSelect {
  /** Only player 1 picks, for online fights where the opponent picks on their own PC. */
  readonly solo = input(false);
  /** Picks to start from, for coming back from the arena select. */
  readonly initial = input<FighterPicks | null>(null);
  readonly confirmed = output<FighterPicks>();
  readonly back = output<void>();

  private readonly store = inject(CharacterStore);
  protected readonly statKeys = STAT_KEYS;
  protected readonly statLabels = STAT_LABELS;
  protected readonly keys = KEYS;
  protected readonly keyName = keyName;
  protected readonly random = RANDOM_FIGHTER;

  protected readonly entries = computed(() => roster(this.store.saved(), this.store.ladderBeaten()));
  protected readonly tiles = computed<Tile[]>(() => [
    ...this.entries().map((e) => ({ id: e.id, entry: e })),
    { id: RANDOM_FIGHTER, entry: null },
  ]);
  protected readonly mode = linkedSignal<OpponentMode>(() => this.initial()?.mode ?? 'cpu');
  protected readonly picks = linkedSignal<[string | null, string | null]>(() => {
    const i = this.initial();
    return i ? [i.p1, i.p2] : [null, null];
  });
  protected readonly cursors = signal<[number, number]>([0, 1]);

  /** With a CPU opponent, player 1 also picks the CPU's fighter once their own is chosen. */
  protected readonly cpuTurn = computed(() => !this.solo() && this.mode() === 'cpu' && this.picks()[0] !== null && this.picks()[1] === null);
  protected readonly ready = computed(() => this.picks()[0] !== null && (this.solo() || this.picks()[1] !== null));
  protected readonly players = computed<(0 | 1)[]>(() => (this.solo() ? [0] : [0, 1]));

  constructor() {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent): void => this.key(e);
    window.addEventListener('keydown', onKey);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('keydown', onKey));
  }

  protected entryAt(player: 0 | 1): RosterEntry | null {
    const pick = this.picks()[player];
    const id = pick ?? this.tiles()[this.cursors()[player]]?.id;
    return this.entries().find((e) => e.id === id) ?? null;
  }

  protected isRandom(player: 0 | 1): boolean {
    return (this.picks()[player] ?? this.tiles()[this.cursors()[player]]?.id) === RANDOM_FIGHTER;
  }

  protected tokensOn(index: number): string[] {
    const tokens: string[] = [];
    for (const p of this.players()) {
      if (this.picks()[p] !== null || !this.cursorActive(p)) continue;
      if (this.cursors()[p] === index) tokens.push(p === 0 ? 'P1' : this.mode() === 'cpu' ? 'CPU' : 'P2');
    }
    return tokens;
  }

  protected pickedBy(id: string): string[] {
    return this.players()
      .filter((p) => this.picks()[p] === id)
      .map((p) => (p === 0 ? 'P1' : this.mode() === 'cpu' ? 'CPU' : 'P2'));
  }

  /** Player 2's cursor only shows once it can move: for a second human, or when it's the CPU's turn. */
  protected cursorActive(p: 0 | 1): boolean {
    if (p === 0) return true;
    return this.mode() === 'local' || this.cpuTurn();
  }

  protected toggleMode(): void {
    this.mode.update((m) => (m === 'cpu' ? 'local' : 'cpu'));
    this.picks.update(([a]) => [a, null]);
  }

  /** A click picks for whoever is picking next. */
  protected click(index: number): void {
    const p = this.picks()[0] === null ? 0 : this.picks()[1] === null && !this.solo() ? 1 : null;
    if (p === null) return;
    this.moveTo(p, index);
    this.pick(p);
  }

  protected unpick(p: 0 | 1): void {
    this.picks.update((picks) => {
      const next = [...picks] as [string | null, string | null];
      next[p] = null;
      // Taking back your own pick in CPU mode also takes back the CPU pick you made.
      if (p === 0 && this.mode() === 'cpu') next[1] = null;
      return next;
    });
  }

  protected go(): void {
    const [p1, p2] = this.picks();
    if (!this.ready() || p1 === null) return;
    this.confirmed.emit({ p1, p2: this.solo() ? null : p2, mode: this.mode() });
  }

  private pick(p: 0 | 1): void {
    const tile = this.tiles()[this.cursors()[p]];
    if (!tile || tile.entry?.locked) return;
    this.picks.update((picks) => {
      const next = [...picks] as [string | null, string | null];
      next[p] = tile.id;
      return next;
    });
  }

  private moveTo(p: 0 | 1, index: number): void {
    this.cursors.update((c) => {
      const next = [...c] as [number, number];
      next[p] = index;
      return next;
    });
  }

  private move(p: 0 | 1, dx: number, dy: number): void {
    const count = this.tiles().length;
    const at = this.cursors()[p];
    let next = at + dx + dy * COLUMNS;
    if (dx !== 0 && Math.floor(next / COLUMNS) !== Math.floor(at / COLUMNS)) next = at;
    if (next < 0 || next >= count) next = dy !== 0 ? at : at;
    this.moveTo(p, next);
  }

  private key(e: KeyboardEvent): void {
    for (const p of [0, 1] as const) {
      const k = KEYS[p];
      if (!Object.values(k).includes(e.code)) continue;
      if (p === 1 && this.solo()) continue;
      e.preventDefault();
      // In CPU mode player 1's keys steer the CPU cursor once their own fighter is picked.
      const target: 0 | 1 = p === 0 && this.cpuTurn() ? 1 : p;
      if (target === 1 && !this.cursorActive(1)) continue;
      if (this.ready() && e.code === k.light) {
        this.go();
        continue;
      }
      if (e.code === k.heavy) {
        if (this.picks()[target] === null && target === 1 && p === 0) this.unpick(0);
        else if (this.picks()[target] !== null) this.unpick(target);
        else if (p === 0 && this.picks()[0] === null) this.back.emit();
        continue;
      }
      if (this.picks()[target] !== null) continue;
      if (e.code === k.left) this.move(target, -1, 0);
      if (e.code === k.right) this.move(target, 1, 0);
      if (e.code === k.up) this.move(target, 0, -1);
      if (e.code === k.down) this.move(target, 0, 1);
      if (e.code === k.light) this.pick(target);
    }
  }
}
