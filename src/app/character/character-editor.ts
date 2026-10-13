import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Appearance,
  BEARD_LABELS,
  BEARD_STYLES,
  Character,
  HAIR_LABELS,
  HAIR_STYLES,
  OUTFIT_LABELS,
  MOVE_SLOTS,
  MoveSlot,
  OUTFIT_STYLES,
  SLOT_LABELS,
  STAT_KEYS,
  STAT_LABELS,
  StatKey,
  findMove,
  movesForSlot,
} from './character.model';
import { STAT_MAX, STAT_MIN, adjustStat, canDecrease, canIncrease, characterErrors, remainingPoints } from './balance';
import { CharacterStore } from './character-store';
import { SpritePreview } from './sprite-preview';

@Component({
  selector: 'app-character-editor',
  imports: [SpritePreview, RouterLink],
  templateUrl: './character-editor.html',
  styleUrl: './character-editor.scss',
})
export class CharacterEditor {
  private readonly store = inject(CharacterStore);

  protected readonly draft = signal<Character>(structuredClone(this.store.saved()));
  protected readonly savedNotice = signal(false);

  protected readonly remaining = computed(() => remainingPoints(this.draft().stats));
  protected readonly errors = computed(() => characterErrors(this.draft()));

  protected readonly hairStyles = HAIR_STYLES;
  protected readonly beardStyles = BEARD_STYLES;
  protected readonly beardLabels = BEARD_LABELS;
  protected readonly outfitStyles = OUTFIT_STYLES;
  protected readonly hairLabels = HAIR_LABELS;
  protected readonly outfitLabels = OUTFIT_LABELS;
  protected readonly slots = MOVE_SLOTS;
  protected readonly slotLabels = SLOT_LABELS;
  protected readonly statKeys = STAT_KEYS;
  protected readonly statLabels = STAT_LABELS;
  protected readonly statMin = STAT_MIN;
  protected readonly statMax = STAT_MAX;
  protected readonly movesForSlot = movesForSlot;
  protected readonly findMove = findMove;

  protected setName(name: string): void {
    this.update((c) => ({ ...c, name }));
  }

  protected setLook<K extends keyof Appearance>(key: K, value: Appearance[K]): void {
    this.update((c) => ({ ...c, appearance: { ...c.appearance, [key]: value } }));
  }

  protected setMove(slot: MoveSlot, id: string): void {
    this.update((c) => ({ ...c, moves: { ...c.moves, [slot]: id } }));
  }

  protected changeStat(key: StatKey, delta: 1 | -1): void {
    this.update((c) => ({ ...c, stats: adjustStat(c.stats, key, delta) }));
  }

  protected canIncrease(key: StatKey): boolean {
    return canIncrease(this.draft().stats, key);
  }

  protected canDecrease(key: StatKey): boolean {
    return canDecrease(this.draft().stats, key);
  }

  protected save(): void {
    this.savedNotice.set(this.store.save(this.draft()));
  }

  private update(change: (c: Character) => Character): void {
    this.draft.update(change);
    this.savedNotice.set(false);
  }
}
