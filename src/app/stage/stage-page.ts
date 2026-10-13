import { Component, DestroyRef, NgZone, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Sound } from '../shared/sound';
import { Pads, merge } from '../shared/pads';
import { TouchControls } from '../shared/touch-controls';
import { CharacterStore } from '../character/character-store';
import { seeded } from '../arena/painter';
import { Controls, NO_INPUT, FPS } from '../fight/combat';
import { KeyMap } from '../fight/controls';
import { KeyBindings } from '../fight/key-bindings';
import { CharacterSelect, FighterPicks } from '../select/character-select';
import { resolvePick } from '../select/roster';
import { StagePlayer } from './brawl';
import { Campaign, createCampaign, startStage, stepCampaign } from './campaign';
import { StageScreen } from './stage-screen';
import { STAGES } from './stages';

type Phase = 'select' | 'play' | 'won';

/**
 * Co-op stage mode: alone, with a friend on the same keyboard or with a CPU partner,
 * fight left to right through five stages of enemy waves, each ending with a ladder boss.
 */
@Component({
  selector: 'app-stage-page',
  imports: [RouterLink, CharacterSelect, StageScreen, NgTemplateOutlet, TouchControls],
  templateUrl: './stage-page.html',
  styleUrls: ['../fight/fight-page.scss', './stage-page.scss'],
})
export class StagePage {
  private readonly store = inject(CharacterStore);
  private readonly bindings = inject(KeyBindings);
  private readonly screen = viewChild(StageScreen);

  protected readonly stageCount = STAGES.length;

  protected readonly phase = signal<Phase>('select');
  protected readonly together = signal(true);
  protected readonly teamSize = signal(1);
  protected readonly over = signal(false);
  protected readonly paused = signal(false);
  protected readonly sound = inject(Sound);
  private readonly pads = inject(Pads);

  private campaign: Campaign | null = null;
  private random = seeded(Date.now());
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();

  constructor() {
    const destroyRef = inject(DestroyRef);
    if (typeof window === 'undefined') return;
    const onDown = (e: KeyboardEvent): void => {
      if (this.phase() === 'play' && (e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
        e.preventDefault();
        this.togglePause();
        return;
      }
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
        this.pads.poll();
        if (this.phase() === 'play' && (this.pads.tapped(0, 'pause') || this.pads.tapped(1, 'pause'))) this.togglePause();
        if (!this.paused()) this.tick();
        this.pads.consumed();
        carry -= 1 / FPS;
      }
      raf = requestAnimationFrame(loop);
    };
    inject(NgZone).runOutsideAngular(() => (raf = requestAnimationFrame(loop)));
    destroyRef.onDestroy(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    });
  }

  protected togglePause(): void {
    if (this.over()) return;
    this.paused.update((p) => !p);
    this.held.clear();
    this.pads.releaseAll();
    this.sound.play('menu');
  }

  protected setTogether(value: boolean): void {
    this.together.set(value);
  }

  protected begin(picks: FighterPicks): void {
    const entries = this.store.roster();
    const random = seeded(Date.now());
    const team: StagePlayer[] = [{ character: resolvePick(picks.p1, entries, random).character, brain: 'human' }];
    if (picks.p2) {
      team.push({ character: resolvePick(picks.p2, entries, random).character, brain: picks.mode === 'cpu' ? 'ally' : 'human' });
    }
    this.campaign = createCampaign(team);
    this.teamSize.set(team.length);
    this.over.set(false);
    this.paused.set(false);
    this.phase.set('play');
  }

  protected retry(): void {
    if (!this.campaign) return;
    startStage(this.campaign, this.campaign.state.stage.index);
    this.over.set(false);
  }

  protected restart(): void {
    this.campaign = null;
    this.paused.set(false);
    this.sound.stopMusic();
    this.phase.set('select');
  }

  private tick(): void {
    const c = this.campaign;
    if (this.phase() !== 'play' || !c) return;
    const keys = this.bindings.keys();
    const controls = [merge(this.read(keys[0]), this.pads.controls(0)), merge(this.read(keys[1]), this.pads.controls(1))];
    this.pressed.clear();
    const cleared = stepCampaign(c, controls, this.random);
    if (cleared) void this.store.recordLadder(cleared, true);
    if (c.won) {
      this.phase.set('won');
      return;
    }
    this.screen()?.show(c.state, c.run);
    this.over.set(c.state.phase === 'gameover');
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
