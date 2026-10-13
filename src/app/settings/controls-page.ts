import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { KEY_ACTIONS, KEY_ACTION_LABELS, KeyAction, KeyBindings, labelFor } from '../fight/key-bindings';

/** Change the keys for player 1 and player 2. Saved in this browser only. */
@Component({
  selector: 'app-controls-page',
  imports: [RouterLink],
  templateUrl: './controls-page.html',
  styleUrl: './controls-page.scss',
})
export class ControlsPage {
  protected readonly bindings = inject(KeyBindings);
  protected readonly actions = KEY_ACTIONS;
  protected readonly labels = KEY_ACTION_LABELS;
  protected readonly players = [0, 1] as const;
  /** The binding waiting for a key press, if any. */
  protected readonly listening = signal<{ player: 0 | 1; action: KeyAction } | null>(null);
  protected readonly notice = signal<string | null>(null);

  constructor() {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent): void => this.key(e);
    // Capture phase, so the key is taken before anything else on the page reacts to it.
    window.addEventListener('keydown', onKey, true);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('keydown', onKey, true));
  }

  protected listen(player: 0 | 1, action: KeyAction): void {
    this.notice.set(null);
    this.listening.set({ player, action });
  }

  protected reset(player: 0 | 1): void {
    this.bindings.reset(player);
    this.listening.set(null);
    this.notice.set(`Spieler ${player + 1} hat wieder die Standardtasten.`);
  }

  protected isListening(player: 0 | 1, action: KeyAction): boolean {
    const l = this.listening();
    return !!l && l.player === player && l.action === action;
  }

  private key(e: KeyboardEvent): void {
    const l = this.listening();
    if (!l) return;
    e.preventDefault();
    e.stopPropagation();
    this.listening.set(null);
    if (e.code === 'Escape') {
      this.notice.set('Abgebrochen, die Taste bleibt wie sie war.');
      return;
    }
    const label = labelFor(e);
    const { swappedWith } = this.bindings.bind(l.player, l.action, e.code, label);
    const what = `Spieler ${l.player + 1} · ${KEY_ACTION_LABELS[l.action]}`;
    if (swappedWith) {
      const other = `Spieler ${swappedWith.player + 1} · ${KEY_ACTION_LABELS[swappedWith.action]}`;
      const otherKey = this.bindings.name(this.bindings.keys()[swappedWith.player][swappedWith.action]);
      this.notice.set(`${label} war schon belegt. ${what} hat jetzt ${label}, ${other} hat dafür ${otherKey} bekommen.`);
    } else {
      this.notice.set(`${what}: ${label}`);
    }
  }
}
