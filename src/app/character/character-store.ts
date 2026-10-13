import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Character } from './character.model';
import { characterErrors, defaultCharacter } from './balance';
import { EDIT_TOKEN_HEADER, FighterStats, FighterWithStats, OwnedFighter, StoredFighter } from '../shared/api';
import { RosterEntry, rivalEntry, roster } from '../select/roster';

/**
 * The browser remembers which fighters it created, with the edit token for each, and which
 * one is played right now. The fighters themselves live in the server's data file.
 */
const FIGHTER_ID_KEY = 'southbeat.fighterId';
const OWNED_KEY = 'southbeat.fighters';
/** Fighters of other players picked to show up on the select screen. */
const RIVALS_KEY = 'southbeat.rivals';
export const MAX_RIVALS = 8;

/** A fighter this browser created: only with its token can it be changed. */
export interface OwnedEntry {
  id: string;
  token: string | null;
}

@Injectable({ providedIn: 'root' })
export class CharacterStore {
  private readonly http = inject(HttpClient);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly saved = signal<Character>(defaultCharacter());
  readonly stats = signal<FighterStats | null>(null);
  /** Single-player opponents beaten so far. Kept in memory only until the fighter is saved. */
  readonly ladderBeaten = signal<string[]>([]);
  readonly isSaved = signal(false);
  /** True once the saved fighter has been fetched, or there is none to fetch. */
  readonly loaded = signal(false);

  /** All fighters made in this browser. */
  readonly owned = signal<OwnedEntry[]>([]);
  /** Other players' fighters on the select screen, newest first. */
  readonly rivals = signal<RosterEntry[]>([]);

  constructor() {
    this.owned.set(this.readOwned());
    void this.loadRivals();
    const id = this.fighterId();
    if (id) void this.load(id).finally(() => this.loaded.set(true));
    else this.loaded.set(this.browser);
  }

  /** Plays another of this browser's fighters. */
  async select(id: string): Promise<void> {
    this.writeKey(FIGHTER_ID_KEY, id);
    this.loaded.set(false);
    await this.load(id);
    this.loaded.set(true);
  }

  /** Starts a fresh fighter; the current ones stay in the list. */
  startNew(): void {
    try {
      localStorage.removeItem(FIGHTER_ID_KEY);
    } catch {
      // Nothing stored, nothing to forget.
    }
    this.saved.set(defaultCharacter());
    this.stats.set(null);
    this.ladderBeaten.set([]);
    this.isSaved.set(false);
  }

  /** Everyone who can be picked: own fighter, rivals, built-in and content fighters. */
  roster(): RosterEntry[] {
    return roster(this.saved(), this.ladderBeaten(), this.rivals());
  }

  isRival(id: string): boolean {
    return this.rivals().some((r) => r.id === rivalEntry(id, this.saved()).id);
  }

  /** Puts another player's fighter on the select screen; the oldest drops off past the limit. */
  addRival(fighter: StoredFighter): void {
    const entry = rivalEntry(fighter.id, toCharacter(fighter));
    this.rivals.update((list) => [entry, ...list.filter((r) => r.id !== entry.id)].slice(0, MAX_RIVALS));
    this.writeRivals();
  }

  removeRival(id: string): void {
    const key = rivalEntry(id, this.saved()).id;
    this.rivals.update((list) => list.filter((r) => r.id !== key));
    this.writeRivals();
  }

  private async loadRivals(): Promise<void> {
    if (!this.browser) return;
    let ids: string[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(RIVALS_KEY) ?? '[]');
      ids = Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string').slice(0, MAX_RIVALS) : [];
    } catch {
      return;
    }
    const found = await Promise.all(
      ids.map((id) =>
        firstValueFrom(this.http.get<FighterWithStats>(`/api/fighters/${encodeURIComponent(id)}`)).then(
          (r) => rivalEntry(r.fighter.id, toCharacter(r.fighter)),
          () => null,
        ),
      ),
    );
    // Picked while loading wins; deleted fighters drop out.
    const loaded = found.filter((r): r is RosterEntry => r !== null);
    this.rivals.update((now) => [...now, ...loaded.filter((r) => !now.some((n) => n.id === r.id))].slice(0, MAX_RIVALS));
  }

  private writeRivals(): void {
    this.writeKey(RIVALS_KEY, JSON.stringify(this.rivals().map((r) => r.id.slice(r.id.indexOf(':') + 1))));
  }

  /** The edit token of the current fighter, for the online server to count results. */
  editToken(): string | null {
    const id = this.fighterId();
    return this.owned().find((o) => o.id === id)?.token ?? null;
  }

  /** A ladder opponent can be fought once everyone before them is beaten. */
  unlocked(opponentIndex: number, order: readonly { id: string }[]): boolean {
    return order.slice(0, opponentIndex).every((o) => this.ladderBeaten().includes(o.id));
  }

  /** Creates or updates the player's fighter in the data file. */
  async save(character: Character): Promise<boolean> {
    if (characterErrors(character).length > 0) return false;
    const id = this.fighterId();
    try {
      const stored = await firstValueFrom(
        id
          ? this.http.put<StoredFighter | OwnedFighter>(`/api/fighters/${encodeURIComponent(id)}`, character, { headers: this.headers() })
          : this.http.post<OwnedFighter>('/api/fighters', character),
      );
      this.remember(stored.id, 'editToken' in stored ? stored.editToken : undefined);
      this.isSaved.set(true);
      this.saved.set(toCharacter(stored));
      this.stats.update((s) => s ?? { matches: 0, wins: 0, losses: 0 });
      return true;
    } catch {
      return false;
    }
  }

  /** Records a single-player result; saved to the data file when the fighter is saved. */
  async recordLadder(opponentId: string, won: boolean): Promise<void> {
    if (won && !this.ladderBeaten().includes(opponentId)) this.ladderBeaten.update((b) => [...b, opponentId]);
    const id = this.fighterId();
    if (!id) return;
    try {
      await firstValueFrom(this.http.post(`/api/fighters/${encodeURIComponent(id)}/ladder`, { opponentId, won }, { headers: this.headers() }));
    } catch {
      // Progress stays in memory for this session.
    }
  }

  private async load(id: string): Promise<void> {
    try {
      const { fighter, stats, ladderBeaten } = await firstValueFrom(
        this.http.get<FighterWithStats>(`/api/fighters/${encodeURIComponent(id)}`),
      );
      this.saved.set(toCharacter(fighter));
      this.stats.set(stats);
      this.ladderBeaten.set(ladderBeaten ?? []);
      this.isSaved.set(true);
      // Saved by an older version without a token: saving once claims it for this browser.
      if (!this.owned().some((o) => o.id === id && o.token)) await this.save(toCharacter(fighter));
    } catch {
      // Unknown or unreachable: the editor starts from the default character.
    }
  }

  /** The id of the saved fighter, or null if it was never saved. */
  fighterId(): string | null {
    if (!this.browser) return null;
    try {
      return localStorage.getItem(FIGHTER_ID_KEY);
    } catch {
      return null;
    }
  }

  private headers(): HttpHeaders {
    const token = this.editToken();
    return token ? new HttpHeaders({ [EDIT_TOKEN_HEADER]: token }) : new HttpHeaders();
  }

  private remember(id: string, token?: string): void {
    this.writeKey(FIGHTER_ID_KEY, id);
    this.owned.update((list) => {
      const known = list.find((o) => o.id === id);
      if (known) return token ? list.map((o) => (o.id === id ? { id, token } : o)) : list;
      return [...list, { id, token: token ?? null }];
    });
    this.writeKey(OWNED_KEY, JSON.stringify(this.owned()));
  }

  private readOwned(): OwnedEntry[] {
    if (!this.browser) return [];
    try {
      const list = JSON.parse(localStorage.getItem(OWNED_KEY) ?? '[]') as OwnedEntry[];
      const clean = Array.isArray(list) ? list.filter((o) => typeof o?.id === 'string').map((o) => ({ id: o.id, token: typeof o.token === 'string' ? o.token : null })) : [];
      // The fighter of an older version, saved before this list existed.
      const current = localStorage.getItem(FIGHTER_ID_KEY);
      if (current && !clean.some((o) => o.id === current)) clean.push({ id: current, token: null });
      return clean;
    } catch {
      return [];
    }
  }

  private writeKey(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Without storage the fighter is still saved, it just gets a new id next time.
    }
  }
}

/** Fighters saved before a field existed get its default. */
export function toCharacter({ name, appearance, moves, stats, projectileArt }: StoredFighter): Character {
  const defaults = defaultCharacter();
  return {
    name,
    appearance: { ...defaults.appearance, ...appearance },
    moves: { ...defaults.moves, ...moves },
    stats,
    projectileArt: projectileArt ?? defaults.projectileArt,
  };
}
