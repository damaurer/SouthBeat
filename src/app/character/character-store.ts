import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Character } from './character.model';
import { characterErrors, defaultCharacter } from './balance';

const STORAGE_KEY = 'southbeat.character';

/** Keeps the player's character in the browser until there is a backend. */
@Injectable({ providedIn: 'root' })
export class CharacterStore {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly saved = signal<Character>(this.load());

  save(character: Character): boolean {
    if (characterErrors(character).length > 0) return false;
    this.saved.set(character);
    if (this.browser) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
      } catch {
        // Storage can be blocked; the character stays in memory.
      }
    }
    return true;
  }

  private load(): Character {
    if (!this.browser) return defaultCharacter();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Character) : null;
      return parsed && characterErrors(parsed).length === 0 ? parsed : defaultCharacter();
    } catch {
      return defaultCharacter();
    }
  }
}
