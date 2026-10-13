import { Component, DestroyRef, ElementRef, NgZone, afterNextRender, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CharacterStore } from '../character/character-store';
import { findArena, paintArena } from '../arena/arenas';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../arena/props';
import { seeded } from '../arena/painter';
import { MoveSlot } from '../character/character.model';
import { BEST_OF_THREE, Controls, DEFAULT_CPU, FightState, METER_MAX, NO_INPUT, ROUND_FRAMES, FPS, createFight, step } from './combat';
import { DIFFICULTIES, DIFFICULTY_LABELS, Difficulty, cpuControls, cpuFor, saveDifficulty, savedDifficulty } from './cpu';
import { Sound } from '../shared/sound';
import { Pads, merge } from '../shared/pads';
import { TouchControls } from '../shared/touch-controls';
import { roundBanner } from './rounds';
import { OPPONENTS, findOpponent } from '../singleplayer/opponents';
import { Effects } from './effects';
import { fightEffects, renderFight } from './render';
import { KeyMap } from './controls';
import { KeyBindings } from './key-bindings';
import { picksFromQuery } from '../select/select-page';
import { OWN_FIGHTER, RosterEntry, resolvePick, roster } from '../select/roster';
import { HIT_LINES, HIT_LINE_COOLDOWN, LineDeck, saysSomething } from './hit-lines';

type Mode = 'cpu' | 'local';

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
  round: number;
  wins: [number, number];
  /** "Runde 2", "FIGHT!" or "K.O.!" across the screen. */
  call: string | null;
  banner: string | null;
  result: string | null;
  /** One speech bubble per fighter: left for player 1, right for player 2. */
  bubbles: [Bubble | null, Bubble | null];
}

interface Bubble {
  speaker: string;
  text: string;
}

/** How long a speech bubble stays on screen. */
const BUBBLE_FRAMES = 150;
/** Hit reactions are short, so they go away sooner. */
const HIT_BUBBLE_FRAMES = 90;

@Component({
  selector: 'app-fight-page',
  imports: [RouterLink, TouchControls],
  templateUrl: './fight-page.html',
  styleUrl: './fight-page.scss',
})
export class FightPage {
  private readonly store = inject(CharacterStore);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  /** Set when the fight is part of the single-player ladder. */
  protected readonly opponent = findOpponent(this.query.get('opponent'));
  protected readonly nextOpponent = this.opponent ? OPPONENTS[OPPONENTS.indexOf(this.opponent) + 1] : undefined;
  protected readonly arena = findArena(this.opponent?.arenaId ?? this.query.get('arena') ?? '');
  protected readonly width = ARENA_WIDTH;
  protected readonly height = ARENA_HEIGHT;
  protected readonly meterMax = METER_MAX;
  private readonly bindings = inject(KeyBindings);
  protected get keys(): [KeyMap, KeyMap] {
    return this.bindings.keys();
  }
  /** Free fights get their fighters and mode from the select screens. */
  protected readonly picks = picksFromQuery(this.query) ?? { p1: OWN_FIGHTER, p2: 'sparring', mode: 'cpu' as Mode };
  protected readonly mode = signal<Mode>(this.opponent ? 'cpu' : this.picks.mode);
  protected readonly hud = signal<Hud | null>(null);
  protected readonly paused = signal(false);
  protected readonly difficulty = signal<Difficulty>('normal');
  protected readonly difficulties = DIFFICULTIES;
  protected readonly difficultyLabels = DIFFICULTY_LABELS;
  protected readonly sound = inject(Sound);
  private readonly pads = inject(Pads);
  private readonly router = inject(Router);
  private lastCall: string | null = null;

  private state!: FightState;
  private cpu = DEFAULT_CPU;
  private readonly fx = new Effects();
  private banner: { text: string; frames: number } | null = null;
  private bubbles: [{ text: string; until: number } | null, { text: string; until: number } | null] = [null, null];
  private nextBubbleAt = 0;
  private chatter = new LineDeck([]);
  private hitDecks: [LineDeck, LineDeck] = [new LineDeck(HIT_LINES), new LineDeck(HIT_LINES)];
  private lastHitLine: [number, number] = [-Infinity, -Infinity];
  private resultRecorded = false;
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private random = seeded(Date.now());

  constructor() {
    const destroyRef = inject(DestroyRef);
    const zone = inject(NgZone);
    this.reset();
    // Ladder opponents are only open once everyone before them is beaten.
    effect(() => {
      const o = this.opponent;
      if (o && this.store.loaded() && !this.store.unlocked(OPPONENTS.indexOf(o), OPPONENTS)) {
        void this.router.navigate(['/singleplayer']);
      }
    });
    // The player's fighter may arrive from the server just after the page opens; restart with it if the round has barely begun.
    effect(() => {
      const fighter = this.store.saved();
      untracked(() => {
        if (this.state.fighters[0].character !== fighter && this.state.frame < FPS) this.reset();
      });
    });
    afterNextRender(() => {
      const ctx = this.canvas().nativeElement.getContext('2d')!;
      const arena = paintArena(this.arena);
      this.difficulty.set(savedDifficulty());
      this.reset();
      this.sound.startMusic(this.arena.id);
      const onDown = (e: KeyboardEvent): void => {
        if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
          e.preventDefault();
          this.togglePause();
          return;
        }
        if (!this.bindings.isGameKey(e.code)) return;
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
          this.pads.poll();
          if (this.pads.tapped(0, 'pause') || this.pads.tapped(1, 'pause')) this.togglePause();
          if (!this.paused()) this.tick();
          this.pads.consumed();
          carry -= 1 / FPS;
        }
        const frame = renderFight(arena, this.state, this.fx);
        ctx.putImageData(new ImageData(frame.toRgba(), frame.width, frame.height), 0, 0);
        raf = requestAnimationFrame(loop);
      };
      // The game loop runs outside Angular; only the HUD signal triggers change detection.
      zone.runOutsideAngular(() => (raf = requestAnimationFrame(loop)));

      destroyRef.onDestroy(() => {
        this.sound.stopMusic();
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onDown);
        window.removeEventListener('keyup', onUp);
      });
    });
  }

  /** The two fighters: in single player the ladder opponent, otherwise whoever was picked. */
  private lineup(): [RosterEntry, RosterEntry] {
    const entries = roster(this.store.saved(), this.store.ladderBeaten());
    const random = seeded(1);
    const me = resolvePick(this.opponent ? OWN_FIGHTER : this.picks.p1, entries, random);
    if (this.opponent) {
      const o = this.opponent;
      return [me, { id: o.id, name: o.character.name, title: o.title, character: o.character, hitLines: o.hitLines, cpu: o.cpu, locked: false }];
    }
    return [me, resolvePick(this.picks.p2 ?? 'sparring', entries, random)];
  }

  protected reset(): void {
    const [a, b] = this.lineup();
    const rank = this.opponent ? OPPONENTS.indexOf(this.opponent) : 1;
    this.cpu = cpuFor(b.cpu, this.difficulty(), rank);
    this.state = createFight(a.character, b.character, this.arena.id, BEST_OF_THREE);
    this.paused.set(false);
    this.lastCall = null;
    this.fx.clear();
    this.banner = null;
    this.bubbles = [null, null];
    this.nextBubbleAt = FPS / 2;
    this.chatter = new LineDeck(this.opponent?.lines ?? []);
    this.hitDecks = [new LineDeck(a.hitLines), new LineDeck(b.hitLines)];
    this.lastHitLine = [-Infinity, -Infinity];
    this.resultRecorded = false;
    this.random = seeded(Date.now());
    this.updateHud();
  }

  protected togglePause(): void {
    if (this.state.winner !== null) return;
    this.paused.update((p) => !p);
    this.held.clear();
    this.pads.releaseAll();
    this.sound.play('menu');
  }

  protected setDifficulty(d: Difficulty): void {
    this.difficulty.set(d);
    saveDifficulty(d);
    this.reset();
  }

  private tick(): void {
    const controls: [Controls, Controls] = [
      merge(this.read(this.keys[0]), this.pads.controls(0)),
      this.opponent || this.mode() === 'cpu'
        ? cpuControls(this.state, 1, this.random, this.cpu)
        : merge(this.read(this.keys[1]), this.pads.controls(1)),
    ];
    this.pressed.clear();
    step(this.state, controls);

    for (const e of this.state.events) {
      if (e.type === 'hit') {
        this.reactToHit((1 - e.attacker) as 0 | 1, e.slot);
        this.sound.hit(e.slot);
      } else if (e.type === 'block') {
        this.sound.play('block');
      } else if (e.type === 'ultimate') {
        this.banner = { text: `${this.state.fighters[e.fighter].character.name}: ${e.move.name}!`, frames: 90 };
        this.sound.play('ultimate');
      }
    }
    const call = roundBanner(this.state);
    if (call !== this.lastCall) {
      if (call === 'FIGHT!') this.sound.play('fight');
      else if (call?.startsWith('Runde') || call === 'Finale Runde') this.sound.play('round');
      else if (call === 'K.O.!' || call === 'Zeit!') this.sound.play('ko');
      this.lastCall = call;
    }
    fightEffects(this.fx, this.state);
    this.updateBubble();
    if (this.opponent && this.state.winner !== null && !this.resultRecorded) {
      this.resultRecorded = true;
      void this.store.recordLadder(this.opponent.id, this.state.winner === 0);
    }
    if (this.banner && --this.banner.frames <= 0) this.banner = null;
    this.updateHud();
  }

  /** Speech bubbles are cosmetic: they never touch the fight state. */
  private updateBubble(): void {
    const frame = this.state.frame;
    if (this.state.winner !== null) {
      this.bubbles = [null, null];
      return;
    }
    this.bubbles = this.bubbles.map((b) => (b && frame < b.until ? b : null)) as typeof this.bubbles;
    const o = this.opponent;
    if (o && !this.bubbles[1] && frame >= this.nextBubbleAt) {
      this.bubbles[1] = { text: this.chatter.draw(this.random), until: frame + BUBBLE_FRAMES };
      this.nextBubbleAt = frame + BUBBLE_FRAMES + Math.round(o.chattiness * FPS * (0.5 + this.random()));
    }
  }

  /** Now and then a fighter who takes a hit says something about it. */
  private reactToHit(fighter: 0 | 1, slot: MoveSlot): void {
    const frame = this.state.frame;
    if (frame - this.lastHitLine[fighter] < HIT_LINE_COOLDOWN || !saysSomething(slot, this.random)) return;
    this.lastHitLine[fighter] = frame;
    this.bubbles[fighter] = { text: this.hitDecks[fighter].draw(this.random), until: frame + HIT_BUBBLE_FRAMES };
  }

  private read(keys: KeyMap): Controls {
    if (!keys) return NO_INPUT;
    return {
      left: this.held.has(keys.left),
      right: this.held.has(keys.right),
      // A quick tap may be released before the next frame; it still counts as a jump.
      up: this.held.has(keys.up) || this.pressed.has(keys.up),
      down: this.held.has(keys.down),
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
    if (this.opponent?.boss && s.winner === 0) result = `${this.opponent.character.name} ist besiegt! Du hast das Büro erobert!`;
    this.hud.set({
      fighters: [fighter(0), fighter(1)],
      seconds: Math.ceil((ROUND_FRAMES - s.frame) / FPS),
      round: s.round,
      wins: s.wins,
      call: roundBanner(s),
      banner: this.banner?.text ?? null,
      result,
      bubbles: [0, 1].map((i) => {
        const b = this.bubbles[i];
        return b ? { speaker: s.fighters[i].character.name, text: b.text } : null;
      }) as Hud['bubbles'],
    });
  }

  protected won(): boolean {
    return this.state.winner === 0;
  }

  protected keyName(code: string): string {
    return this.bindings.name(code);
  }
}
