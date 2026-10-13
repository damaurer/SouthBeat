import { Component, computed, input, output, signal } from '@angular/core';
import { ART_PALETTE, ART_PRESETS, ART_SIZE, emptyArt, paintArtCell } from './projectile-art';

/** A small drawing grid for the player's own projectile. */
@Component({
  selector: 'app-pixel-editor',
  template: `
    <div class="editor">
      <div
        class="grid"
        role="img"
        aria-label="Zeichenfläche für das Geschoss"
        (pointerdown)="start($event)"
        (pointermove)="move($event)"
        (pointerup)="drawing = false"
        (pointercancel)="drawing = false"
        (pointerleave)="drawing = false"
      >
        @for (cell of cells(); track $index) {
          <span [style.background]="cell ?? null" [class.empty]="!cell"></span>
        }
      </div>

      <div class="tools">
        <div class="palette" role="radiogroup" aria-label="Farbe">
          @for (entry of palette; track entry.key) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="brush() === entry.key"
              [attr.aria-label]="'Farbe ' + entry.color"
              [class.active]="brush() === entry.key"
              [style.background]="entry.color"
              (click)="brush.set(entry.key)"
            ></button>
          }
          <button
            type="button"
            role="radio"
            class="eraser"
            [attr.aria-checked]="brush() === '.'"
            [class.active]="brush() === '.'"
            (click)="brush.set('.')"
          >
            Radierer
          </button>
        </div>
        <div class="actions">
          <label>
            Vorlage
            <select #preset (change)="usePreset(preset.value); preset.value = ''">
              <option value="">wählen …</option>
              @for (p of presets; track p.key) {
                <option [value]="p.key">{{ p.label }}</option>
              }
            </select>
          </label>
          <button type="button" class="btn" (click)="artChange.emit(clear())">Leeren</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .editor { display: grid; grid-template-columns: minmax(0, 192px) minmax(0, 1fr); gap: 12px; }
    @media (max-width: 480px) { .editor { grid-template-columns: 1fr; } }
    .grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      aspect-ratio: 1;
      max-width: 192px;
      width: 100%;
      border: 2px solid currentColor;
      touch-action: none;
      cursor: crosshair;
      user-select: none;
    }
    .grid span { outline: 1px solid rgb(255 255 255 / 8%); }
    .grid span.empty {
      background: repeating-conic-gradient(#2a2a40 0 25%, #222234 0 50%) 0 0 / 50% 50%;
    }
    .palette { display: flex; flex-wrap: wrap; gap: 4px; }
    .palette button { width: 22px; height: 22px; min-width: 0; padding: 0; border: 2px solid #444; cursor: pointer; }
    .palette button.active { border-color: #f1c40f; outline: 2px solid #f1c40f; }
    .palette .eraser { width: auto; padding: 0 6px; font: inherit; font-size: 0.75rem; background: #ddd; color: #14141f; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; align-items: center; }
  `,
})
export class PixelEditor {
  readonly art = input.required<string[]>();
  readonly artChange = output<string[]>();

  protected readonly brush = signal('4');
  protected readonly palette = Object.entries(ART_PALETTE).map(([key, color]) => ({ key, color }));
  protected readonly presets = Object.entries(ART_PRESETS).map(([key, p]) => ({ key, label: p.label }));
  protected readonly cells = computed(() => this.art().flatMap((row) => row.split('').map((c) => ART_PALETTE[c] ?? null)));
  protected drawing = false;

  protected start(e: PointerEvent): void {
    this.drawing = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    this.paint(e);
  }

  protected move(e: PointerEvent): void {
    if (this.drawing) this.paint(e);
  }

  protected usePreset(key: string): void {
    const preset = ART_PRESETS[key];
    if (preset) this.artChange.emit([...preset.art]);
  }

  protected clear(): string[] {
    return emptyArt();
  }

  private paint(e: PointerEvent): void {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * ART_SIZE);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * ART_SIZE);
    const next = paintArtCell(this.art(), x, y, this.brush());
    if (next !== this.art()) this.artChange.emit(next);
  }
}
