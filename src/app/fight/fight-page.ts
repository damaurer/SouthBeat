import { Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CharacterStore } from '../character/character-store';
import { SPARRING_PARTNER } from '../character/sparring';
import { findArena, paintArena } from '../arena/arenas';
import { ARENA_HEIGHT, ARENA_WIDTH, GROUND_Y } from '../arena/props';
import { seeded } from '../arena/painter';
import { Controls, FightState, METER_MAX, NO_INPUT, ROUND_FRAMES, FPS, cpuControls, createFight, step } from './combat';
import { Spark, renderFight } from './render';

type Mode = 'cpu' | 'local';

interface KeyMap {
  left: string;
  right: string;
  light: string;
  heavy: string;
  kick: string;
  special: string;
  ultimate: string;
}

const KEYS: [KeyMap, KeyMap] = [
  { left: 'KeyA', right: 'KeyD', light: 'KeyF', heavy: 'KeyG', kick: 'KeyH', special: 'KeyT', ultimate: 'Space' },
  { left: 'ArrowLeft', right: 'ArrowRight', light: 'KeyJ', heavy: 'KeyK', kick: 'KeyL', special: 'KeyI', ultimate: 'Enter' },
];
const GAME_KEYS = new Set(KEYS.flatMap((k) => Object.values(k)));

interface FighterHud {
  name: string;
  hp: number;
  maxHp: number;
  meter: number;
  ready: boolean;
}

interface Hud {
  fighters: [FighterHud, FighterHud];
  seconds: number;
  banner: string | null;
  result: string | null;
}

@Component({
  selector: 'app-fight-page',
  imports: [RouterLink],
  templateUrl: './fight-page.html',
  styleUrl: './fight-page.scss',
})
export class FightPage {
  private readonly store = inject(CharacterStore);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly arena = findArena(inject(ActivatedRoute).snapshot.queryParamMap.get('arena') ?? '');
  protected readonly width = ARENA_WIDTH;
  protected readonly height = ARENA_HEIGHT;
  protected readonly meterMax = METER_MAX;
  protected readonly keys = KEYS;
  protected readonly mode = signal<Mode>('cpu');
  protected readonly hud = signal<Hud | null>(null);

  private state!: FightState;
  private sparks: Spark[] = [];
  private banner: { text: string; frames: number } | null = null;
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private random = seeded(Date.now());

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.reset();
    afterNextRender(() => {
      const ctx = this.canvas().nativeElement.getContext('2d')!;
      const arena = paintArena(this.arena);
      const onDown = (e: KeyboardEvent): void => {
        if (!GAME_KEYS.has(e.code)) return;
        e.preventDefault();
        if (!e.repeat) this.pressed.add(e.code);
        this.held.add(e.code);
      };
      const onUp = (e: KeyboardEvent): void => {
        this.held.delete(e.code);
      };
      window.addEventListener('keydown', onDown);
      window.addEventListener('keyup', onUp);

      let last = performance.now();
      let carry = 0;
      let raf = 0;
      const loop = (now: number): void => {
        carry = Math.min(carry + (now - last) / 1000, 5 / FPS);
        last = now;
        while (carry >= 1 / FPS) {
          this.tick();
          carry -= 1 / FPS;
        }
        const frame = renderFight(arena, this.state, this.sparks);
        ctx.putImageData(new ImageData(frame.toRgba(), frame.width, frame.height), 0, 0);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      destroyRef.onDestroy(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onDown);
        window.removeEventListener('keyup', onUp);
      });
    });
  }

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    this.reset();
  }

  protected reset(): void {
    this.state = createFight(this.store.saved(), SPARRING_PARTNER, this.arena.id);
    this.sparks = [];
    this.banner = null;
    this.random = seeded(Date.now());
    this.updateHud();
  }

  private tick(): void {
    const controls: [Controls, Controls] = [
      this.read(KEYS[0]),
      this.mode() === 'cpu' ? cpuControls(this.state, 1, this.random) : this.read(KEYS[1]),
    ];
    this.pressed.clear();
    step(this.state, controls);

    for (const e of this.state.events) {
      if (e.type === 'hit') {
        const target = this.state.fighters[1 - e.attacker];
        this.sparks.push({ x: target.x, y: GROUND_Y - 28, life: 12, big: e.slot === 'ultimate' });
      } else if (e.type === 'ultimate') {
        this.banner = { text: `${this.state.fighters[e.fighter].character.name}: ${e.move.name}!`, frames: 90 };
      }
    }
    this.sparks = this.sparks.filter((s) => --s.life > 0);
    if (this.banner && --this.banner.frames <= 0) this.banner = null;
    this.updateHud();
  }

  private read(keys: KeyMap): Controls {
    if (!keys) return NO_INPUT;
    return {
      left: this.held.has(keys.left),
      right: this.held.has(keys.right),
      light: this.pressed.has(keys.light),
      heavy: this.pressed.has(keys.heavy),
      kick: this.pressed.has(keys.kick),
      special: this.pressed.has(keys.special),
      ultimate: this.pressed.has(keys.ultimate),
    };
  }

  private updateHud(): void {
    const s = this.state;
    const fighter = (i: 0 | 1): FighterHud => {
      const f = s.fighters[i];
      return { name: f.character.name, hp: f.hp, maxHp: f.maxHp, meter: f.meter, ready: f.meter >= METER_MAX };
    };
    let result: string | null = null;
    if (s.winner === 'draw') result = 'Unentschieden!';
    else if (s.winner !== null) result = `${s.fighters[s.winner].character.name} gewinnt!`;
    this.hud.set({
      fighters: [fighter(0), fighter(1)],
      seconds: Math.ceil((ROUND_FRAMES - s.frame) / FPS),
      banner: this.banner?.text ?? null,
      result,
    });
  }

  protected keyName(code: string): string {
    return code.replace(/^Key/, '').replace('Arrow', '').replace('Left', '←').replace('Right', '→').replace('Space', 'Leertaste');
  }
}
