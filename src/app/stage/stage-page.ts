import { Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CharacterStore } from '../character/character-store';
import { findArena } from '../arena/arenas';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../arena/props';
import { Painter, seeded } from '../arena/painter';
import { Controls, METER_MAX, NO_INPUT, FPS } from '../fight/combat';
import { KeyMap } from '../fight/controls';
import { HIT_LINES, HIT_LINE_COOLDOWN, LineDeck, saysSomething } from '../fight/hit-lines';
import { KeyBindings } from '../fight/key-bindings';
import { Spark } from '../fight/render';
import { CharacterSelect, FighterPicks } from '../select/character-select';
import { resolvePick, roster } from '../select/roster';
import { Brawler, StagePlayer, StageState, createStage, stepStage } from './brawl';
import { renderStage, feetY } from './render-stage';
import { ITEM_NAMES, STAGES, paintStage } from './stages';

type Phase = 'select' | 'play' | 'won';

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
 * Co-op stage mode: alone, with a friend on the same keyboard or with a CPU partner,
 * fight left to right through five stages of enemy waves, each ending with a ladder boss.
 */
@Component({
  selector: 'app-stage-page',
  imports: [RouterLink, CharacterSelect],
  templateUrl: './stage-page.html',
  styleUrls: ['../fight/fight-page.scss', './stage-page.scss'],
})
export class StagePage {
  private readonly store = inject(CharacterStore);
  private readonly bindings = inject(KeyBindings);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly width = ARENA_WIDTH;
  protected readonly height = ARENA_HEIGHT;
  protected readonly meterMax = METER_MAX;
  protected readonly stageCount = STAGES.length;

  protected readonly phase = signal<Phase>('select');
  protected readonly together = signal(true);
  protected readonly players = signal<BrawlerHud[]>([]);
  protected readonly boss = signal<{ name: string; hp: number; maxHp: number } | null>(null);
  protected readonly banner = signal<string | null>(null);
  protected readonly go = signal(false);
  protected readonly over = signal(false);
  protected readonly stageTitle = signal('');
  protected readonly bubble = signal<Bubble | null>(null);

  private team: StagePlayer[] = [];
  private state: StageState | null = null;
  private world: Painter | null = null;
  private sparks: Spark[] = [];
  private bannerUntil = 0;
  private advanceAt = 0;
  private random = seeded(Date.now());
  private chatter = new LineDeck([]);
  private bossHit = new LineDeck([]);
  private playerHit = new LineDeck(HIT_LINES);
  private lastLine = -Infinity;
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();

  constructor() {
    const destroyRef = inject(DestroyRef);
    if (typeof window === 'undefined') return;
    const onDown = (e: KeyboardEvent): void => {
      if (this.phase() !== 'play' || !this.bindings.isGameKey(e.code)) return;
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
      this.draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    destroyRef.onDestroy(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    });
    effect(() => {
      if (this.canvas()) this.draw();
    });
  }

  protected setTogether(value: boolean): void {
    this.together.set(value);
  }

  protected begin(picks: FighterPicks): void {
    const entries = roster(this.store.saved(), this.store.ladderBeaten());
    const random = seeded(Date.now());
    const one = resolvePick(picks.p1, entries, random).character;
    this.team = [{ character: one, brain: 'human' }];
    if (picks.p2) {
      const two = resolvePick(picks.p2, entries, random).character;
      this.team.push({ character: two, brain: picks.mode === 'cpu' ? 'ally' : 'human' });
    }
    this.load(0);
  }

  protected retry(): void {
    if (this.state) this.load(this.state.stage.index);
  }

  protected restart(): void {
    this.state = null;
    this.phase.set('select');
  }

  private load(index: number, carry?: Brawler[]): void {
    const stage = STAGES[index];
    this.state = createStage(stage, this.team, carry);
    this.world = paintStage(stage);
    this.sparks = [];
    this.advanceAt = 0;
    this.over.set(false);
    this.go.set(false);
    this.bubble.set(null);
    this.chatter = new LineDeck(stage.boss.lines);
    this.bossHit = new LineDeck(stage.boss.hitLines);
    const title = `Stage ${index + 1} · ${findArena(stage.arenaId).name}`;
    this.stageTitle.set(`${title} · Boss: ${stage.boss.character.name}`);
    this.show(title, 150);
    this.phase.set('play');
    this.updateHud();
  }

  private show(text: string, frames: number): void {
    this.banner.set(text);
    this.bannerUntil = (this.state?.frame ?? 0) + frames;
  }

  private tick(): void {
    const s = this.state;
    if (this.phase() !== 'play' || !s) return;
    const keys = this.bindings.keys();
    const controls = [this.read(keys[0]), this.read(keys[1])];
    this.pressed.clear();
    stepStage(s, controls, this.random);

    for (const e of s.events) {
      if (e.type === 'hit') {
        const t = s.brawlers.find((b) => b.id === e.target)!;
        this.sparks.push({ x: t.x, y: feetY(t.z) - 28, life: 12, big: e.slot === 'ultimate' });
        this.react(t, e.slot);
      } else if (e.type === 'pickup') {
        const who = s.brawlers.find((b) => b.id === e.who)!;
        this.show(`${who.name}: ${ITEM_NAMES[e.kind]}!`, 60);
      } else if (e.type === 'ultimate') {
        const who = s.brawlers.find((b) => b.id === e.who)!;
        this.show(`${who.name}: ${e.move.name}!`, 80);
      } else if (e.type === 'boss') {
        this.show(`Boss: ${s.stage.boss.character.name}!`, 120);
      }
    }
    this.sparks = this.sparks.filter((sp) => --sp.life > 0);
    this.talk(s);

    if (s.phase === 'cleared') {
      if (this.advanceAt === 0) {
        this.advanceAt = s.frame + 180;
        this.store.recordLadder(s.stage.boss.id, true);
        this.show(s.stage.index + 1 < STAGES.length ? 'Stage geschafft!' : 'Alle Stages geschafft!', 180);
      }
      // stepStage stops counting frames once a stage is over, so count here.
      s.frame++;
      if (s.frame >= this.advanceAt) {
        if (s.stage.index + 1 < STAGES.length) this.load(s.stage.index + 1, s.brawlers);
        else this.phase.set('won');
      }
    }
    if (this.banner() && s.frame >= this.bannerUntil) this.banner.set(null);
    this.go.set(s.phase === 'go');
    this.over.set(s.phase === 'gameover');
    this.updateHud();
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

  private react(t: Brawler, slot: Parameters<typeof saysSomething>[0]): void {
    const s = this.state!;
    if (t.brain === 'grunt' || s.frame - this.lastLine < HIT_LINE_COOLDOWN || !saysSomething(slot, this.random)) return;
    this.lastLine = s.frame;
    const deck = t.brain === 'boss' ? this.bossHit : this.playerHit;
    this.bubble.set({ speaker: t.name, text: deck.draw(this.random), until: s.frame + 90 });
  }

  private updateHud(): void {
    const s = this.state;
    if (!s) return;
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
    const frame = renderStage(this.world, this.state, this.sparks);
    canvas.getContext('2d')!.putImageData(new ImageData(frame.toRgba(), frame.width, frame.height), 0, 0);
  }

  private read(k: KeyMap): Controls {
    return {
      ...NO_INPUT,
      left: this.held.has(k.left),
      right: this.held.has(k.right),
      up: this.held.has(k.up),
      down: this.held.has(k.down),
      light: this.pressed.has(k.light),
      heavy: this.pressed.has(k.heavy),
      kick: this.pressed.has(k.kick),
      special: this.pressed.has(k.special),
      ultimate: this.pressed.has(k.ultimate),
    };
  }

  protected keyName(code: string): string {
    return this.bindings.name(code);
  }

  protected get keys(): [KeyMap, KeyMap] {
    return this.bindings.keys();
  }
}
