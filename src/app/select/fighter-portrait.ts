import { Component, ElementRef, afterRenderEffect, input, viewChild } from '@angular/core';
import { Appearance } from '../character/character.model';
import { SPRITE_HEIGHT, SPRITE_WIDTH, spritePixels } from '../character/sprite';

/** Head-and-shoulders crop for the character grid; the panels show the whole fighter. */
const FACE_ROWS = 24;

@Component({
  selector: 'app-fighter-portrait',
  template: `<canvas #canvas aria-hidden="true" [width]="width" [height]="crop() === 'face' ? faceRows : fullRows"></canvas>`,
  styles: `
    :host { display: block; }
    canvas { width: 100%; height: 100%; image-rendering: pixelated; display: block; object-fit: contain; }
  `,
})
export class FighterPortrait {
  readonly look = input.required<Appearance>();
  readonly crop = input<'face' | 'full'>('face');
  /** Locked fighters are drawn as a dark silhouette. */
  readonly silhouette = input(false);

  protected readonly width = SPRITE_WIDTH;
  protected readonly faceRows = FACE_ROWS;
  protected readonly fullRows = SPRITE_HEIGHT;
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    afterRenderEffect(() => {
      const look = this.look();
      const rows = this.crop() === 'face' ? FACE_ROWS : SPRITE_HEIGHT;
      const dark = this.silhouette();
      const ctx = this.canvas().nativeElement.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);
      for (const p of spritePixels(look)) {
        if (p.y >= rows) continue;
        ctx.fillStyle = dark ? '#0b0b12' : p.fill;
        ctx.fillRect(p.x, p.y, 1, 1);
      }
    });
  }
}
