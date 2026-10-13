import { Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { findArena } from '../arena/arenas';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../arena/props';
import { Painter, seeded } from '../arena/painter';
import { FPS, METER_MAX } from '../fight/combat';
import { HIT_LINES, HIT_LINE_COOLDOWN, LineDeck, saysSomething } from '../fight/hit-lines';
import { Spark } from '../fight/render';
import { Brawler, StageState } from './brawl';
import { renderStage, feetY } from './render-stage';
import { ITEM_NAMES, STAGES, paintStage } from './stages';

interface BrawlerHud {
  name: string;
  hp: number;
  maxHp: number;
  meter: number;
  lives: number;
  weapon: string | null;
  cpu: boolean;
  out: boolean;
}

interface Bubble {
  speaker: string;
  text: string;
  until: number;
}

/**
 * Shows a running stage: the team's bars, the boss bar, the picture, speech bubbles and
 * banners. It only watches the stage state it is handed, so the same screen works for the
 * local stage mode and for an online stage run by the server.
 * Overlays such as the game over box go inside the tag and appear on top of the picture.
 */
@Component({
  selector: 'app-stage-screen',
  templateUrl: './stage-screen.html',
  styleUrls: ['../fight/fight-page.scss', './stage-page.scss'],
})
export class StageScreen {
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  /** Online: which player is you, so your bar says so. */
  readonly you = input<0 | 1 | null>(null);

  protected readonly width = ARENA_WIDTH;
  protected readonly height = ARENA_HEIGHT;
  protected readonly meterMax = METER_MAX;

  protected readonly players = signal<BrawlerHud[]>([]);
  protected readonly boss = signal<{ name: string; hp: number; maxHp: number } | null>(null);
  protected readonly banner = signal<string | null>(null);
  protected readonly go = signal(false);
  protected readonly title = signal('');
  protected readonly bubble = signal<Bubble | null>(null);

  private state: StageState | null = null;
  private run = 0;
  private world: Painter | null = null;
  private sparks: Spark[] = [];
  private bannerUntil = 0;
  private clearedShown = false;
  private dirty = false;
  private random = seeded(Date.now());
  private chatter = new LineDeck([]);
  private bossHit = new LineDeck([]);
  private playerHit = new LineDeck(HIT_LINES);
  private lastLine = -Infinity;

  constructor() {
    if (typeof window === 'undefined') return;
    let raf = 0;
    const loop = (): void => {
      if (this.dirty) this.draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(raf));
  }

  /** Call once per stage frame. `run` changes whenever a new stage (or a retry) starts. */
  show(s: StageState, run: number): void {
    if (run !== this.run) this.begin(s, run);
    this.state = s;
    for (const e of s.events) {
      if (e.type === 'hit') {
        const t = s.brawlers.find((b) => b.id === e.target);
        if (!t) continue;
        this.sparks.push({ x: t.x, y: feetY(t.z) - 28, life: 12, big: e.slot === 'ultimate' });
        this.react(s, t, e.slot);
      } else if (e.type === 'pickup') {
        const who = s.brawlers.find((b) => b.id === e.who);
        if (who) this.flash(s, `${who.name}: ${ITEM_NAMES[e.kind]}!`, 60);
      } else if (e.type === 'ultimate') {
        const who = s.brawlers.find((b) => b.id === e.who);
        if (who) this.flash(s, `${who.name}: ${e.move.name}!`, 80);
      } else if (e.type === 'boss') {
        this.flash(s, `Boss: ${s.stage.boss.character.name}!`, 120);
      }
    }
    if (s.phase === 'cleared' && !this.clearedShown) {
      this.clearedShown = true;
      this.flash(s, s.stage.index + 1 < STAGES.length ? 'Stage geschafft!' : 'Alle Stages geschafft!', 180);
    }
    this.sparks = this.sparks.filter((sp) => --sp.life > 0);
    this.talk(s);
    if (this.banner() && s.frame >= this.bannerUntil) this.banner.set(null);
    this.go.set(s.phase === 'go');
    this.updateHud(s);
    this.dirty = true;
  }

  private begin(s: StageState, run: number): void {
    this.run = run;
    this.world = paintStage(s.stage);
    this.sparks = [];
    this.clearedShown = false;
    this.bubble.set(null);
    this.chatter = new LineDeck(s.stage.boss.lines);
    this.bossHit = new LineDeck(s.stage.boss.hitLines);
    this.lastLine = -Infinity;
    const name = `Stage ${s.stage.index + 1} · ${findArena(s.stage.arenaId).name}`;
    this.title.set(`${name} · Boss: ${s.stage.boss.character.name}`);
    this.flash(s, name, 150);
  }

  private flash(s: StageState, text: string, frames: number): void {
    this.banner.set(text);
    this.bannerUntil = s.frame + frames;
  }

  /** The boss talks now and then; anyone who gets hit may say something. */
  private talk(s: StageState): void {
    const b = this.bubble();
    if (b && s.frame >= b.until) this.bubble.set(null);
    const boss = s.brawlers.find((x) => x.id === s.bossId && !x.out && x.hp > 0);
    if (boss && !this.bubble() && this.random() < 1 / (s.stage.boss.chattiness * FPS)) {
      this.bubble.set({ speaker: boss.name, text: this.chatter.draw(this.random), until: s.frame + 150 });
    }
  }

  private react(s: StageState, t: Brawler, slot: Parameters<typeof saysSomething>[0]): void {
    if (t.brain === 'grunt' || s.frame - this.lastLine < HIT_LINE_COOLDOWN || !saysSomething(slot, this.random)) return;
    this.lastLine = s.frame;
    const deck = t.brain === 'boss' ? this.bossHit : this.playerHit;
    this.bubble.set({ speaker: t.name, text: deck.draw(this.random), until: s.frame + 90 });
  }

  private updateHud(s: StageState): void {
    this.players.set(
      s.brawlers
        .filter((b) => b.team === 'player')
        .map((b) => ({
          name: b.name,
          hp: b.hp,
          maxHp: b.maxHp,
          meter: b.meter,
          lives: Math.max(0, b.lives),
          weapon: b.weapon ? `Tastatur ×${b.weapon.uses}` : null,
          cpu: b.brain === 'ally',
          out: b.out,
        })),
    );
    const boss = s.brawlers.find((b) => b.id === s.bossId);
    this.boss.set(boss && !boss.out ? { name: boss.name, hp: boss.hp, maxHp: boss.maxHp } : null);
  }

  private draw(): void {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas || !this.state || !this.world) return;
    this.dirty = false;
    const frame = renderStage(this.world, this.state, this.sparks);
    canvas.getContext('2d')!.putImageData(new ImageData(frame.toRgba(), frame.width, frame.height), 0, 0);
  }
}
