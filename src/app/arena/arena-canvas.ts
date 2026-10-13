import { Component, ElementRef, afterRenderEffect, input, viewChild } from '@angular/core';
import { Appearance } from '../character/character.model';
import { SPRITE_HEIGHT, SPRITE_WIDTH, spritePixels } from '../character/sprite';
import { Arena, paintArena } from './arenas';
import { ARENA_HEIGHT, ARENA_WIDTH, GROUND_Y } from './props';

/** Fighter positions: left one faces right, right one is mirrored to face left. */
const FIGHTER_X = [70, 138];

@Component({
  selector: 'app-arena-canvas',
  template: `<canvas #canvas [width]="width" [height]="height" [attr.aria-label]="arena().name"></canvas>`,
  styles: `
    :host { display: block; aspect-ratio: 16 / 9; background: #0b0d1a; }
    canvas { width: 100%; height: 100%; image-rendering: pixelated; display: block; }
  `,
})
export class ArenaCanvas {
  readonly arena = input.required<Arena>();
  readonly fighters = input<Appearance[]>([]);

  protected readonly width = ARENA_WIDTH;
  protected readonly height = ARENA_HEIGHT;
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    // Runs only in the browser and after the canvas size is set, which would otherwise clear it.
    afterRenderEffect(() => {
      const arena = this.arena();
      const fighters = this.fighters();
      const ctx = this.canvas().nativeElement.getContext('2d');
      if (!ctx) return;
      const p = paintArena(arena);
      fighters.slice(0, 2).forEach((look, i) =>
        p.sprite(FIGHTER_X[i], GROUND_Y - SPRITE_HEIGHT, spritePixels(look), SPRITE_WIDTH, i === 1),
      );
      ctx.putImageData(new ImageData(p.toRgba(), p.width, p.height), 0, 0);
    });
  }
}
