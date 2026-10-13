import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Character } from './character.model';
import { characterErrors, defaultCharacter } from './balance';
import { FighterStats, FighterWithStats, StoredFighter } from '../shared/api';

/** The browser only remembers which fighter is the player's; the fighter itself lives in the server's data file. */
const FIGHTER_ID_KEY = 'southbeat.fighterId';

@Injectable({ providedIn: 'root' })
export class CharacterStore {
  private readonly http = inject(HttpClient);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly saved = signal<Character>(defaultCharacter());
  readonly stats = signal<FighterStats | null>(null);

  constructor() {
    const id = this.fighterId();
    if (id) void this.load(id);
  }

  /** Creates or updates the player's fighter in the data file. */
  async save(character: Character): Promise<boolean> {
    if (characterErrors(character).length > 0) return false;
    const id = this.fighterId();
    try {
      const stored = await firstValueFrom(
        id
          ? this.http.put<StoredFighter>(`/api/fighters/${encodeURIComponent(id)}`, character)
          : this.http.post<StoredFighter>('/api/fighters', character),
      );
      this.remember(stored.id);
      this.saved.set(toCharacter(stored));
      this.stats.update((s) => s ?? { matches: 0, wins: 0, losses: 0 });
      return true;
    } catch {
      return false;
    }
  }

  private async load(id: string): Promise<void> {
    try {
      const { fighter, stats } = await firstValueFrom(this.http.get<FighterWithStats>(`/api/fighters/${encodeURIComponent(id)}`));
      this.saved.set(toCharacter(fighter));
      this.stats.set(stats);
    } catch {
      // Unknown or unreachable: the editor starts from the default character.
    }
  }

  private fighterId(): string | null {
    if (!this.browser) return null;
    try {
      return localStorage.getItem(FIGHTER_ID_KEY);
    } catch {
      return null;
    }
  }

  private remember(id: string): void {
    try {
      localStorage.setItem(FIGHTER_ID_KEY, id);
    } catch {
      // Without storage the fighter is still saved, it just gets a new id next time.
    }
  }
}

function toCharacter({ name, appearance, moves, stats }: StoredFighter): Character {
  return { name, appearance, moves, stats };
}
