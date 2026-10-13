import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { Appearance } from './character.model';
import { analyzePhoto } from './photo-analysis';

/** Longest side the photo is scaled to before analysis; enough for colors, fast to scan. */
const ANALYSIS_SIZE = 160;

/**
 * Lets the player pick a photo and turns it into a starting look.
 * The photo never leaves the browser: it is read, analyzed and then dropped.
 */
@Component({
  selector: 'app-photo-import',
  template: `
    <div class="photo">
      <label class="pick">
        <input type="file" accept="image/*" (change)="pick($event)" />
        <span>{{ preview() ? 'Anderes Foto wählen' : 'Foto wählen' }}</span>
      </label>
      @if (preview(); as src) {
        <img [src]="src" alt="Gewähltes Foto" />
      }
      @switch (state()) {
        @case ('working') {
          <p>Foto wird ausgewertet …</p>
        }
        @case ('done') {
          <p class="ok">Übernommen: {{ notes().join(', ') }}. Passe den Rest unten an.</p>
        }
        @case ('no-face') {
          <p class="warn">Kein Gesicht erkannt. Am besten klappt ein Porträt von vorne, gut beleuchtet, vor ruhigem Hintergrund.</p>
        }
        @case ('error') {
          <p class="warn">Das Bild konnte nicht gelesen werden.</p>
        }
      }
      <p class="privacy">Das Foto bleibt auf deinem Gerät. Es wird weder hochgeladen noch gespeichert.</p>
    </div>
  `,
  styles: `
    .photo { display: grid; gap: 8px; }
    .pick input { position: absolute; opacity: 0; width: 1px; height: 1px; }
    .pick span { display: inline-block; padding: 6px 14px; background: #f1c40f; color: #14141f; font-weight: bold; cursor: pointer; }
    .pick:focus-within span { outline: 2px solid #ffffff; }
    img { max-width: 120px; max-height: 120px; object-fit: cover; border: 2px solid currentColor; }
    p { margin: 0; }
    .ok { color: #2ecc71; }
    .warn { color: #f39c12; }
    .privacy { font-size: 0.8rem; opacity: 0.75; }
  `,
})
export class PhotoImport {
  readonly lookFound = output<Partial<Appearance>>();

  protected readonly preview = signal<string | null>(null);
  protected readonly state = signal<'idle' | 'working' | 'done' | 'no-face' | 'error'>('idle');
  protected readonly notes = signal<string[]>([]);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revoke());
  }

  protected async pick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.revoke();
    this.preview.set(URL.createObjectURL(file));
    this.state.set('working');
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, ANALYSIS_SIZE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const guess = analyzePhoto(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (!guess) {
        this.state.set('no-face');
        return;
      }
      this.notes.set(guess.notes);
      this.state.set('done');
      this.lookFound.emit(guess.appearance);
    } catch {
      this.state.set('error');
    }
  }

  private revoke(): void {
    const url = this.preview();
    if (url) URL.revokeObjectURL(url);
  }
}
