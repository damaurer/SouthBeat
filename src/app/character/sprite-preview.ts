import { Component, computed, input } from '@angular/core';
import { Appearance } from './character.model';
import { SPRITE_HEIGHT, SPRITE_WIDTH, spritePixels } from './sprite';

@Component({
  selector: 'app-sprite-preview',
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + width + ' ' + height"
      shape-rendering="crispEdges"
      role="img"
      aria-label="Vorschau des Charakters"
    >
      @for (p of pixels(); track $index) {
        <rect [attr.x]="p.x" [attr.y]="p.y" width="1" height="1" [attr.fill]="p.fill" />
      }
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { width: 100%; height: 100%; }
  `,
})
export class SpritePreview {
  readonly appearance = input.required<Appearance>();
  protected readonly width = SPRITE_WIDTH;
  protected readonly height = SPRITE_HEIGHT;
  protected readonly pixels = computed(() => spritePixels(this.appearance()));
}
