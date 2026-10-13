import { Component, computed, input } from '@angular/core';
import { Appearance } from './character.model';
import { STANCE } from '../fight/animate';
import { posedSprite } from '../fight/pose';
import { SPRITE_HEIGHT, SPRITE_WIDTH } from './sprite';

/** Room around the sprite box for the arms of the side view, and above it for tall figures. */
const PAD = 4;
const PAD_TOP = 6;

@Component({
  selector: 'app-sprite-preview',
  template: `
    <svg
      [attr.viewBox]="-pad + ' ' + -padTop + ' ' + width + ' ' + height"
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
  protected readonly pad = PAD;
  protected readonly padTop = PAD_TOP;
  protected readonly width = SPRITE_WIDTH + PAD * 2;
  protected readonly height = SPRITE_HEIGHT + PAD_TOP;
  /** The fighter as seen in a fight: from the side, in guard. */
  protected readonly pixels = computed(() => posedSprite(this.appearance(), STANCE));
}
