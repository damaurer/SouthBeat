import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CharacterStore } from '../character/character-store';
import { SPARRING_PARTNER } from '../character/sparring';
import { ARENAS, Arena } from './arenas';
import { ArenaCanvas } from './arena-canvas';


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
  protected readonly fighters = computed(() => [this.store.saved().appearance, SPARRING_PARTNER.appearance]);
  protected readonly playerName = computed(() => this.store.saved().name);
}
