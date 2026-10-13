import { Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../arena/props';
import { CharacterStore } from '../character/character-store';
import { KeyBindings } from '../fight/key-bindings';
import { OPPONENTS } from '../singleplayer/opponents';
import { TitleScene } from './title-scene';

interface MenuEntry {
  label: string;
  link: string;
  hint: string;
}

const MENU: MenuEntry[] = [
  { label: 'Einzelspieler', link: '/singleplayer', hint: 'Kämpf dich durch die Chefetage bis zum Endboss.' },
  { label: 'Stage-Modus (Koop)', link: '/stages', hint: 'Zu zweit von links nach rechts durch fünf Büros.' },
  { label: 'Freier Kampf', link: '/select', hint: 'Gegen die CPU oder zu zweit an einer Tastatur.' },
  { label: 'Online-Kampf', link: '/online', hint: 'Gegen jemanden an einem anderen PC.' },
  { label: 'Charakter erstellen', link: '/editor', hint: 'Aussehen, Moves, Werte und dein eigenes Geschoss.' },
  { label: 'Steuerung', link: '/controls', hint: 'Tasten für Spieler 1 und 2 einstellen.' },
];

/** Title screen: animated rooftop scene, a blinking PRESS START and a keyboard-driven menu. */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly router = inject(Router);
  private readonly store = inject(CharacterStore);
  private readonly bindings = inject(KeyBindings);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly menu = MENU;
  protected readonly width = ARENA_WIDTH;
  protected readonly height = ARENA_HEIGHT;
  /** The menu shows after PRESS START, like in the arcade. */
  protected readonly started = signal(false);
  protected readonly cursor = signal(0);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const ctx = this.canvas().nativeElement.getContext('2d')!;
      const scene = new TitleScene();
      let raf = 0;
      let frame = 0;
      let last = performance.now();
      let carry = 0;
      const loop = (now: number): void => {
        carry = Math.min(carry + (now - last) / 1000, 0.1);
        last = now;
        while (carry >= 1 / 60) {
          frame++;
          carry -= 1 / 60;
        }
        // The player's own fighter spars against a different boss every few rounds.
        const rival = OPPONENTS[Math.floor(frame / 480) % OPPONENTS.length].character.appearance;
        const p = scene.render(frame, this.store.saved().appearance, rival);
        ctx.putImageData(new ImageData(p.toRgba(), p.width, p.height), 0, 0);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      const onKey = (e: KeyboardEvent): void => this.key(e);
      window.addEventListener('keydown', onKey);
      destroyRef.onDestroy(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKey);
      });
    });
  }

  protected start(): void {
    this.started.set(true);
  }

  private key(e: KeyboardEvent): void {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (!this.started()) {
      e.preventDefault();
      this.start();
      return;
    }
    const keys = this.bindings.keys();
    const is = (...codes: string[]): boolean => codes.includes(e.code);
    const up = is('ArrowUp', ...keys.map((k) => k.up));
    const down = is('ArrowDown', ...keys.map((k) => k.down));
    const confirm = is('Enter', 'Space', 'NumpadEnter', ...keys.map((k) => k.light));
    if (!up && !down && !confirm) return;
    e.preventDefault();
    const n = MENU.length;
    if (up) this.cursor.update((c) => (c + n - 1) % n);
    if (down) this.cursor.update((c) => (c + 1) % n);
    if (confirm) void this.router.navigateByUrl(MENU[this.cursor()].link);
  }
}
