import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CharacterStore, MAX_RIVALS, toCharacter } from '../character/character-store';
import { Character } from '../character/character.model';
import { FighterStats, FighterWithStats, ListedFighter, StatsSummary } from '../shared/api';
import { FighterPortrait } from '../select/fighter-portrait';
import { OWN_FIGHTER, RIVAL_PREFIX } from '../select/roster';

type Tab = 'mine' | 'all' | 'best';
const TABS: Tab[] = ['mine', 'all', 'best'];

interface MineRow {
  id: string;
  character: Character | null;
  record: FighterStats;
  beaten: number;
}

/** How many fighters the list shows before "Mehr zeigen". */
const PAGE = 40;

/**
 * Your fighters, everyone's fighters and the leaderboard. Other players' fighters can be put
 * on the select screen as rivals and fought against the computer.
 */
@Component({
  selector: 'app-fighters-page',
  imports: [RouterLink, FighterPortrait],
  templateUrl: './fighters-page.html',
  styleUrl: './fighters-page.scss',
})
export class FightersPage {
  protected readonly store = inject(CharacterStore);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly tabs = TABS;
  protected readonly tabLabels: Record<Tab, string> = { mine: 'Meine Kämpfer', all: 'Alle Kämpfer', best: 'Bestenliste' };
  protected readonly tab = signal<Tab>(this.startTab());
  protected readonly maxRivals = MAX_RIVALS;

  protected readonly mine = signal<MineRow[] | null>(null);
  protected readonly all = signal<ListedFighter[] | null>(null);
  protected readonly summary = signal<StatsSummary | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly shown = signal(PAGE);

  private readonly ownIds = computed(() => new Set(this.store.owned().map((o) => o.id)));
  protected readonly current = computed(() => (this.store.isSaved() ? this.store.fighterId() : null));

  /** Newest first, filtered by name. */
  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return [...(this.all() ?? [])].filter((f) => !q || f.name.toLowerCase().includes(q)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });
  protected readonly byId = computed(() => new Map((this.all() ?? []).map((f) => [f.id, f])));

  constructor() {
    if (!this.browser) return;
    void this.loadMine();
    void this.loadAll();
  }

  private startTab(): Tab {
    const t = inject(ActivatedRoute).snapshot.queryParamMap.get('tab') as Tab;
    return TABS.includes(t) ? t : 'mine';
  }

  protected show(t: Tab): void {
    this.tab.set(t);
    void this.router.navigate([], { queryParams: { tab: t }, replaceUrl: true });
  }

  private async loadMine(): Promise<void> {
    const rows = await Promise.all(
      this.store.owned().map(async ({ id }): Promise<MineRow | null> => {
        try {
          const r = await firstValueFrom(this.http.get<FighterWithStats>(`/api/fighters/${encodeURIComponent(id)}`));
          return { id, character: toCharacter(r.fighter), record: r.stats, beaten: r.ladderBeaten.length };
        } catch {
          return null;
        }
      }),
    );
    this.mine.set(rows.filter((r): r is MineRow => r !== null));
  }

  private async loadAll(): Promise<void> {
    try {
      const [all, summary] = await Promise.all([
        firstValueFrom(this.http.get<ListedFighter[]>('/api/fighters')),
        firstValueFrom(this.http.get<StatsSummary>('/api/stats')),
      ]);
      this.all.set(all);
      this.summary.set(summary);
    } catch {
      this.error.set('Der Server ist gerade nicht erreichbar.');
    }
  }

  protected isOwn(id: string): boolean {
    return this.ownIds().has(id);
  }

  protected async play(id: string, edit = false): Promise<void> {
    if (id !== this.current()) await this.store.select(id);
    if (edit) void this.router.navigate(['/editor']);
  }

  protected newFighter(): void {
    this.store.startNew();
    void this.router.navigate(['/editor']);
  }

  protected toggleRival(f: ListedFighter): void {
    if (this.store.isRival(f.id)) this.store.removeRival(f.id);
    else this.store.addRival(f);
  }

  /** Straight to the arena select: you against this fighter, played by the computer. */
  protected fight(f: ListedFighter): void {
    this.store.addRival(f);
    void this.router.navigate(['/arena'], { queryParams: { p1: OWN_FIGHTER, p2: RIVAL_PREFIX + f.id, mode: 'cpu' } });
  }

  protected look(f: ListedFighter): Character['appearance'] {
    return toCharacter(f).appearance;
  }

  protected quote(r: { wins: number; losses: number }): string {
    const n = r.wins + r.losses;
    return n ? `${Math.round((r.wins / n) * 100)} %` : '–';
  }

  protected more(): void {
    this.shown.update((n) => n + PAGE);
  }
}
