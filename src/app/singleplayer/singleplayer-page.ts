import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CharacterStore } from '../character/character-store';
import { SpritePreview } from '../character/sprite-preview';
import { findMove } from '../character/character.model';
import { findArena } from '../arena/arenas';
import { OPPONENTS, Opponent } from './opponents';

type Status = 'beaten' | 'next' | 'locked';

@Component({
  selector: 'app-singleplayer-page',
  imports: [RouterLink, SpritePreview],
  templateUrl: './singleplayer-page.html',
  styleUrl: './singleplayer-page.scss',
})
export class SingleplayerPage {
  private readonly store = inject(CharacterStore);
  protected readonly isSaved = this.store.isSaved;
  protected readonly player = this.store.saved;

  /** Opponents unlock one after another; beaten ones can be fought again. */
  protected readonly ladder = computed(() => {
    const beaten = new Set(this.store.ladderBeaten());
    let nextFound = false;
    return OPPONENTS.map((opponent) => {
      let status: Status = 'locked';
      if (beaten.has(opponent.id)) status = 'beaten';
      else if (!nextFound) {
        status = 'next';
        nextFound = true;
      }
      return { opponent, status };
    });
  });

  protected readonly cleared = computed(() => this.ladder().every((e) => e.status === 'beaten'));

  protected signature(o: Opponent): string {
    const special = findMove(o.character.moves.special)?.name;
    const ultimate = findMove(o.character.moves.ultimate)?.name;
    return `${special} · Ultimate: ${ultimate}`;
  }

  protected arenaName(o: Opponent): string {
    return findArena(o.arenaId).name;
  }
}
