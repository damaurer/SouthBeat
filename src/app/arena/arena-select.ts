import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CharacterStore } from '../character/character-store';
import { Appearance } from '../character/character.model';
import { defaultCharacter } from '../character/balance';
import { ARENAS, Arena } from './arenas';
import { ArenaCanvas } from './arena-canvas';

/** Stand-in opponent until multiplayer matchmaking exists. */
const SPARRING_PARTNER: Appearance = {
  ...defaultCharacter().appearance,
  skinColor: '#c68642',
  hairColor: '#1c1c1c',
  hairStyle: 'afro',
  beardStyle: 'goatee',
  outfitStyle: 'hoodie',
  outfitColor: '#2b2f3a',
};

@Component({
  selector: 'app-arena-select',
  imports: [ArenaCanvas, RouterLink],
  templateUrl: './arena-select.html',
  styleUrl: './arena-select.scss',
})
export class ArenaSelect {
  private readonly store = inject(CharacterStore);

  protected readonly arenas = ARENAS;
  protected readonly selected = signal<Arena>(ARENAS[0]);
  protected readonly fighters = computed(() => [this.store.saved().appearance, SPARRING_PARTNER]);
  protected readonly playerName = computed(() => this.store.saved().name);
}
