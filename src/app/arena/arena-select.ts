import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CharacterStore } from '../character/character-store';
import { seeded } from './painter';
import { ARENAS, Arena } from './arenas';
import { ArenaCanvas } from './arena-canvas';
import { KeyMap } from '../fight/controls';
import { KeyBindings } from '../fight/key-bindings';
import { OWN_FIGHTER, resolvePick } from '../select/roster';
import { picksFromQuery } from '../select/select-page';

/** Tiles per row in the stage grid. */
const COLUMNS = 4;
const RANDOM_ARENA = 'random';

/**
 * Free fight, step 2: pick the stage. A big preview with both fighters sits on top,
 * the stage grid below; cursor keys or the mouse move the selection.
 */
@Component({
  selector: 'app-arena-select',
  imports: [ArenaCanvas],
  templateUrl: './arena-select.html',
  styleUrl: './arena-select.scss',
})
export class ArenaSelect {
  private readonly store = inject(CharacterStore);
  private readonly router = inject(Router);
  private readonly picks = picksFromQuery(inject(ActivatedRoute).snapshot.queryParamMap) ?? { p1: OWN_FIGHTER, p2: 'sparring', mode: 'cpu' as const };

  protected readonly arenas = ARENAS;
  protected readonly randomId = RANDOM_ARENA;
  private readonly bindings = inject(KeyBindings);
  protected get keys(): [KeyMap, KeyMap] {
    return this.bindings.keys();
  }
  protected readonly keyName = (code: string): string => this.bindings.name(code);
  /** Index into the arenas; one past the end is the random tile. */
  protected readonly cursor = signal(0);
  protected readonly selected = computed<Arena | null>(() => ARENAS[this.cursor()] ?? null);
  protected readonly preview = computed(() => this.selected() ?? ARENAS[Math.floor(Date.now() / 1500) % ARENAS.length]);
  protected readonly fighters = computed(() => {
    const entries = this.store.roster();
    const random = seeded(1);
    return [resolvePick(this.picks.p1, entries, random), resolvePick(this.picks.p2 ?? 'sparring', entries, random)];
  });
  protected readonly looks = computed(() => this.fighters().map((f) => f.character.appearance));
  protected readonly modeLabel = this.picks.mode === 'cpu' ? 'CPU' : 'P2';

  constructor() {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent): void => this.key(e);
    window.addEventListener('keydown', onKey);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('keydown', onKey));
  }

  protected choose(index: number): void {
    this.cursor.set(index);
    this.start();
  }

  protected start(): void {
    const arena = this.selected() ?? ARENAS[Math.floor(Math.random() * ARENAS.length)];
    const [a, b] = this.fighters();
    void this.router.navigate(['/fight'], { queryParams: { arena: arena.id, p1: a.id, p2: b.id, mode: this.picks.mode } });
  }

  protected back(): void {
    void this.router.navigate(['/select'], { queryParams: { ...this.picks } });
  }

  private key(e: KeyboardEvent): void {
    const k = this.keys.find((m) => Object.values(m).includes(e.code));
    if (!k) return;
    e.preventDefault();
    const count = ARENAS.length + 1;
    const at = this.cursor();
    if (e.code === k.left && at % COLUMNS > 0) this.cursor.set(at - 1);
    if (e.code === k.right && at % COLUMNS < COLUMNS - 1 && at + 1 < count) this.cursor.set(at + 1);
    if (e.code === k.up && at - COLUMNS >= 0) this.cursor.set(at - COLUMNS);
    if (e.code === k.down && at + COLUMNS < count) this.cursor.set(at + COLUMNS);
    if (e.code === k.light) this.start();
    if (e.code === k.heavy) this.back();
  }
}
