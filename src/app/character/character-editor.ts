import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ACCESSORIES,
  ACCESSORY_LABELS,
  Appearance,
  BEARD_LABELS,
  BODY_LABELS,
  BODY_SHAPE_KEYS,
  FACE_SHAPE_KEYS,
  SHAPE_LABELS,
  SHAPE_MAX,
  SHAPE_MIN,
  ShapeKey,
  shapeValue,
  BODY_TYPES,
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
  SPECIAL_KIND_LABELS,
  STAT_LABELS,
  StatKey,
  findMove,
  movesForSlot,
  specialKind,
  usesCustomArt,
} from './character.model';
import { STAT_MAX, STAT_MIN, adjustStat, canDecrease, canIncrease, characterErrors, remainingPoints } from './balance';
import { CharacterStore } from './character-store';
import { SpritePreview } from './sprite-preview';
import { PixelEditor } from './pixel-editor';
import { PhotoImport } from './photo-import';
import { DEFAULT_ART } from './projectile-art';

@Component({
  selector: 'app-character-editor',
  imports: [SpritePreview, RouterLink, PixelEditor, PhotoImport],
  templateUrl: './character-editor.html',
  styleUrl: './character-editor.scss',
})
export class CharacterEditor {
  private readonly store = inject(CharacterStore);

  /** Follows the stored fighter (e.g. once it has loaded from the server) until the player edits it. */
  protected readonly draft = linkedSignal<Character>(() => structuredClone(this.store.saved()));
  protected readonly saveState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  protected readonly record = this.store.stats;

  protected readonly remaining = computed(() => remainingPoints(this.draft().stats));
  protected readonly errors = computed(() => characterErrors(this.draft()));

  protected readonly hairStyles = HAIR_STYLES;
  protected readonly bodyTypes = BODY_TYPES;
  protected readonly bodyLabels = BODY_LABELS;
  protected readonly accessories = ACCESSORIES;
  protected readonly accessoryLabels = ACCESSORY_LABELS;
  protected readonly beardStyles = BEARD_STYLES;
  protected readonly beardLabels = BEARD_LABELS;
  protected readonly outfitStyles = OUTFIT_STYLES;
  protected readonly hairLabels = HAIR_LABELS;
  protected readonly shapeGroups: { title: string; keys: readonly ShapeKey[] }[] = [
    { title: 'Körper', keys: BODY_SHAPE_KEYS },
    { title: 'Gesicht', keys: FACE_SHAPE_KEYS },
  ];
  protected readonly shapeLabels = SHAPE_LABELS;
  protected readonly shapeMin = SHAPE_MIN;
  protected readonly shapeMax = SHAPE_MAX;
  protected readonly shapeValue = shapeValue;
  protected readonly shaped = computed(() => Object.keys(this.draft().appearance.shape ?? {}).length > 0);
  protected readonly outfitLabels = OUTFIT_LABELS;
  protected readonly slots = MOVE_SLOTS;
  protected readonly slotLabels = SLOT_LABELS;
  protected readonly statKeys = STAT_KEYS;
  protected readonly statLabels = STAT_LABELS;
  protected readonly statMin = STAT_MIN;
  protected readonly statMax = STAT_MAX;
  protected readonly movesForSlot = movesForSlot;
  protected readonly kindLabel = (id: string): string => {
    const move = findMove(id);
    return move ? SPECIAL_KIND_LABELS[specialKind(move)] : '';
  };
  /** The drawing only matters for thrown specials, so the editor only shows it then. */
  protected readonly throwsArt = computed(() => {
    const move = findMove(this.draft().moves.special);
    return !!move && usesCustomArt(move);
  });
  protected readonly art = computed(() => this.draft().projectileArt ?? DEFAULT_ART);
  protected readonly findMove = findMove;

  protected setName(name: string): void {
    this.update((c) => ({ ...c, name }));
  }

  protected setLook<K extends keyof Appearance>(key: K, value: Appearance[K]): void {
    this.update((c) => ({ ...c, appearance: { ...c.appearance, [key]: value } }));
  }

  /** Moves one slider; values back at 0 are dropped, so untouched fighters stay as before. */
  protected setShape(key: ShapeKey, value: number): void {
    this.update((c) => {
      const shape = { ...c.appearance.shape, [key]: value };
      if (value === 0) delete shape[key];
      const { shape: _, ...rest } = c.appearance;
      return { ...c, appearance: Object.keys(shape).length > 0 ? { ...rest, shape } : rest };
    });
  }

  protected resetShape(): void {
    this.update((c) => {
      const { shape: _, ...rest } = c.appearance;
      return { ...c, appearance: rest };
    });
  }

  protected setMove(slot: MoveSlot, id: string): void {
    this.update((c) => ({ ...c, moves: { ...c.moves, [slot]: id } }));
  }

  /** Applies a look guessed from a photo; name, moves and stats stay as they are. */
  protected applyPhoto(look: Partial<Appearance>): void {
    this.update((c) => ({ ...c, appearance: { ...c.appearance, ...look } }));
  }

  protected setArt(art: string[]): void {
    this.update((c) => ({ ...c, projectileArt: art }));
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

  protected async save(): Promise<void> {
    this.saveState.set('saving');
    this.saveState.set((await this.store.save(this.draft())) ? 'saved' : 'error');
  }

  private update(change: (c: Character) => Character): void {
    this.draft.update(change);
    this.saveState.set('idle');
  }
}
