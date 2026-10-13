import { Component, inject, input, signal, afterNextRender } from '@angular/core';
import { PadButton, Pads } from './pads';

/**
 * On-screen controls for phones and tablets: a d-pad on the left, attack buttons on the
 * right. They only show on touch screens and play for player 1.
 */
@Component({
  selector: 'app-touch-controls',
  template: `
    @if (touch()) {
      <div class="touch" (contextmenu)="$event.preventDefault()">
        <div class="pad">
          @for (b of dirs; track b.id) {
            <button type="button" [class]="b.id" (pointerdown)="down($event, b.id)" (pointerup)="up(b.id)" (pointercancel)="up(b.id)" (pointerleave)="up(b.id)" [attr.aria-label]="b.label">{{ b.icon }}</button>
          }
        </div>
        @if (pause()) {
          <button type="button" class="pause" (pointerdown)="down($event, 'pause')" (pointerup)="up('pause')" aria-label="Pause">II</button>
        }
        <div class="attacks">
          @for (b of attacks; track b.id) {
            <button type="button" [class]="b.id" (pointerdown)="down($event, b.id)" (pointerup)="up(b.id)" (pointercancel)="up(b.id)" (pointerleave)="up(b.id)">{{ b.label }}</button>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .touch { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 12px; user-select: none; touch-action: none; }
    button { font: inherit; font-weight: bold; color: #f0f0f0; background: #2a2d3e; border: 2px solid #f0f0f0; border-radius: 8px; touch-action: none; }
    button:active { background: #f1c40f; color: #14141f; }
    .pad { display: grid; grid-template: repeat(3, 52px) / repeat(3, 52px); }
    .up { grid-area: 1 / 2; } .left { grid-area: 2 / 1; } .right { grid-area: 2 / 3; } .down { grid-area: 3 / 2; }
    .attacks { display: grid; grid-template-columns: repeat(3, 60px); gap: 6px; }
    .attacks button { height: 52px; font-size: 0.7rem; }
    .ultimate { grid-column: span 2; background: #5a3d00; }
    .pause { width: 44px; height: 44px; }
  `,
})
export class TouchControls {
  private readonly pads = inject(Pads);
  readonly pause = input(true);
  protected readonly touch = signal(false);
  protected readonly dirs: { id: PadButton; icon: string; label: string }[] = [
    { id: 'up', icon: '▲', label: 'Springen' },
    { id: 'left', icon: '◀', label: 'Links' },
    { id: 'right', icon: '▶', label: 'Rechts' },
    { id: 'down', icon: '▼', label: 'Ducken' },
  ];
  protected readonly attacks: { id: PadButton; label: string }[] = [
    { id: 'light', label: 'Leicht' },
    { id: 'heavy', label: 'Schwer' },
    { id: 'kick', label: 'Tritt' },
    { id: 'special', label: 'Spezial' },
    { id: 'ultimate', label: 'Ultimate' },
  ];

  constructor() {
    afterNextRender(() => this.touch.set(matchMedia('(pointer: coarse)').matches));
  }

  protected down(e: PointerEvent, b: PadButton): void {
    e.preventDefault();
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    this.pads.press(b);
  }

  protected up(b: PadButton): void {
    this.pads.release(b);
  }
}
