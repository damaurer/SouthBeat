import { Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CharacterStore } from '../character/character-store';
import { Character } from '../character/character.model';
import { ARENAS, findArena, paintArena } from '../arena/arenas';
import { ARENA_HEIGHT, ARENA_WIDTH, GROUND_Y } from '../arena/props';
import { Painter, seeded } from '../arena/painter';
import { FightState, METER_MAX, ROUND_FRAMES, FPS } from '../fight/combat';
import { ATTACK_SLOTS, KEYS, keyName } from '../fight/controls';
import { HIT_LINES, HIT_LINE_COOLDOWN, LineDeck, saysSomething } from '../fight/hit-lines';
import { Spark, renderFight } from '../fight/render';
import { CharacterSelect, FighterPicks } from '../select/character-select';
import { FighterPortrait } from '../select/fighter-portrait';
import { RosterEntry, builtInFighter, resolvePick, roster } from '../select/roster';
import { ClientMessage, FightSnapshot, ONLINE_PATH, ServerMessage, normalizeCode, stateFrom } from './protocol';

type Phase = 'menu' | 'connecting' | 'waiting' | 'fight' | 'left';

interface FighterHud {
  name: string;
  hp: number;
  maxHp: number;
  meter: number;
  ready: boolean;
}

interface Bubble {
  speaker: string;
  text: string;
  until: number;
}

const BUBBLE_FRAMES = 90;

/**
 * Online fights between two PCs. One player opens a room and passes on the four-letter
 * code, the other joins with it. The server runs the fight; this page sends key presses
 * and draws what the server sends back.
 */
@Component({
  selector: 'app-online-page',
  imports: [RouterLink, FormsModule, CharacterSelect, FighterPortrait],
  templateUrl: './online-page.html',
  styleUrls: ['../fight/fight-page.scss', './online-page.scss'],
})
export class OnlinePage {
  private readonly store = inject(CharacterStore);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly arenas = ARENAS;
  protected readonly keys = KEYS[0];
  protected readonly keyName = keyName;
  protected readonly width = ARENA_WIDTH;
  protected readonly height = ARENA_HEIGHT;
  protected readonly meterMax = METER_MAX;

  protected readonly phase = signal<Phase>('menu');
  protected readonly error = signal<string | null>(null);
  protected readonly code = signal('');
  protected readonly arenaName = signal('');
  protected readonly you = signal<0 | 1>(0);
  protected readonly fighters = signal<[FighterHud, FighterHud] | null>(null);
  protected readonly seconds = signal(99);
  protected readonly bubbles = signal<[Bubble | null, Bubble | null]>([null, null]);
  protected readonly banner = signal<string | null>(null);
  protected readonly result = signal<string | null>(null);
  protected readonly rematchBy = signal<(0 | 1)[]>([]);

  /** The fighter picked on the select screen; null until one is picked. */
  protected readonly chosen = signal<RosterEntry | null>(null);
  private readonly router = inject(Router);
  protected joinCode = '';
  protected arenaId = '';

  private socket: WebSocket | null = null;
  private characters: [Character, Character] | null = null;
  private fighterIds: [string | null, string | null] = [null, null];
  private arena: Painter | null = null;
  private state: FightState | null = null;
  private matchArena = '';
  private sparks: Spark[] = [];
  private bannerUntil = 0;
  private recorded = false;
  private random = seeded(Date.now());
  private hitDecks: [LineDeck, LineDeck] = [new LineDeck(HIT_LINES), new LineDeck(HIT_LINES)];
  private lastHitLine: [number, number] = [-Infinity, -Infinity];
  private left = false;
  private right = false;
  private up = false;
  private down = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const onDown = (e: KeyboardEvent): void => this.key(e, true);
    const onUp = (e: KeyboardEvent): void => this.key(e, false);
    let raf = 0;
    const loop = (): void => {
      this.draw();
      raf = requestAnimationFrame(loop);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onDown);
      window.addEventListener('keyup', onUp);
      raf = requestAnimationFrame(loop);
    }
    destroyRef.onDestroy(() => {
      this.socket?.close();
      if (typeof window === 'undefined') return;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    });
    // The canvas only exists during the fight, so the arena is painted once it appears.
    effect(() => {
      if (this.canvas() && this.state) this.draw();
    });
  }

  protected choose(picks: FighterPicks): void {
    const entries = roster(this.store.saved(), this.store.ladderBeaten());
    this.chosen.set(resolvePick(picks.p1, entries, seeded(Date.now())));
  }

  protected home(): void {
    void this.router.navigate(['/']);
  }

  protected create(): void {
    this.connect({ type: 'create', ...this.myFighter(), arenaId: this.arenaId });
  }

  private myFighter(): { rosterId: string; fighter: Character; fighterId: string | null } {
    const c = this.chosen()!;
    return { rosterId: c.id, fighter: c.character, fighterId: this.store.fighterId() };
  }

  protected join(): void {
    const code = normalizeCode(this.joinCode);
    if (code.length !== 4) {
      this.error.set('Der Raumcode hat vier Buchstaben.');
      return;
    }
    this.connect({ type: 'join', code, ...this.myFighter() });
  }

  protected rematch(): void {
    this.send({ type: 'rematch' });
  }

  protected leave(): void {
    this.socket?.close();
    this.socket = null;
    this.state = null;
    this.phase.set('menu');
  }

  private connect(first: ClientMessage): void {
    this.socket?.close();
    this.error.set(null);
    this.phase.set('connecting');
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${location.host}${ONLINE_PATH}`);
    this.socket = socket;
    socket.onopen = () => socket.send(JSON.stringify(first));
    socket.onmessage = (e) => this.receive(JSON.parse(String(e.data)) as ServerMessage);
    socket.onerror = () => {
      if (this.socket !== socket) return;
      this.error.set('Keine Verbindung zum Spielserver. Läuft der SouthBeat-Server?');
      this.phase.set('menu');
    };
    socket.onclose = () => {
      if (this.socket === socket && this.phase() === 'waiting') this.phase.set('menu');
    };
  }

  private receive(msg: ServerMessage): void {
    switch (msg.type) {
      case 'room':
        this.code.set(msg.code);
        this.phase.set('waiting');
        break;
      case 'error':
        this.error.set(msg.message);
        this.socket?.close();
        this.socket = null;
        this.phase.set('menu');
        break;
      case 'start': {
        this.matchArena = msg.arenaId;
        this.characters = msg.characters;
        this.fighterIds = msg.fighterIds;
        this.you.set(msg.you);
        const arena = findArena(msg.arenaId);
        this.arena = paintArena(arena);
        this.arenaName.set(arena.name);
        this.state = null;
        this.sparks = [];
        this.recorded = false;
        this.hitDecks = msg.rosterIds.map((id) => new LineDeck(builtInFighter(id)?.hitLines ?? HIT_LINES)) as [LineDeck, LineDeck];
        this.lastHitLine = [-Infinity, -Infinity];
        this.bubbles.set([null, null]);
        this.banner.set(null);
        this.result.set(null);
        this.rematchBy.set([]);
        this.phase.set('fight');
        break;
      }
      case 'state':
        this.apply(msg.snapshot);
        break;
      case 'rematch-wanted':
        this.rematchBy.update((by) => (by.includes(msg.by) ? by : [...by, msg.by]));
        break;
      case 'opponent-left':
        this.socket?.close();
        this.socket = null;
        this.phase.set('left');
        break;
    }
  }

  private apply(snapshot: FightSnapshot): void {
    if (!this.characters || !this.arena) return;
    const state = stateFrom(snapshot, this.characters, this.matchArena);
    this.state = state;
    for (const e of state.events) {
      if (e.type === 'hit') {
        const target = (1 - e.attacker) as 0 | 1;
        this.sparks.push({ x: state.fighters[target].x, y: GROUND_Y - 28 - state.fighters[target].y, life: 12, big: e.slot === 'ultimate' });
        this.reactToHit(target, e.slot);
      } else if (e.type === 'block') {
        const t = state.fighters[1 - e.attacker];
        this.sparks.push({ x: t.x + t.facing * 10, y: GROUND_Y - 28 - t.y, life: 10, big: false, blocked: true });
      } else if (e.type === 'ultimate') {
        this.banner.set(`${this.characters[e.fighter].name}: ${e.move.name}!`);
        this.bannerUntil = state.frame + 90;
      }
    }
    if (this.banner() && state.frame >= this.bannerUntil) this.banner.set(null);
    this.bubbles.update((b) => b.map((x) => (x && state.frame < x.until ? x : null)) as [Bubble | null, Bubble | null]);
    const hud = (i: 0 | 1): FighterHud => {
      const f = state.fighters[i];
      return { name: f.character.name, hp: f.hp, maxHp: f.maxHp, meter: f.meter, ready: f.meter >= METER_MAX };
    };
    this.fighters.set([hud(0), hud(1)]);
    this.seconds.set(Math.ceil((ROUND_FRAMES - state.frame) / FPS));
    if (state.winner !== null) this.finish(state);
  }

  private reactToHit(fighter: 0 | 1, slot: Parameters<typeof saysSomething>[0]): void {
    const frame = this.state!.frame;
    if (frame - this.lastHitLine[fighter] < HIT_LINE_COOLDOWN || !saysSomething(slot, this.random)) return;
    this.lastHitLine[fighter] = frame;
    const text = this.hitDecks[fighter].draw(this.random);
    this.bubbles.update((b) => {
      const next = [...b] as [Bubble | null, Bubble | null];
      next[fighter] = { speaker: this.characters![fighter].name, text, until: frame + BUBBLE_FRAMES };
      return next;
    });
  }

  private finish(state: FightState): void {
    this.bubbles.set([null, null]);
    const w = state.winner;
    this.result.set(w === 'draw' ? 'Unentschieden!' : w === this.you() ? 'Du gewinnst!' : `${state.fighters[w as 0 | 1].character.name} gewinnt!`);
    // The host records the match so it counts once; both fighters must be saved for it to count.
    const [a, b] = this.fighterIds;
    if (this.recorded || this.you() !== 0 || w === 'draw' || w === null || !a || !b || a === b) return;
    this.recorded = true;
    const [winnerId, loserId] = w === 0 ? [a, b] : [b, a];
    void fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winnerId, loserId, arenaId: state.arenaId }),
    }).catch(() => undefined);
  }

  private draw(): void {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas || !this.state || !this.arena) return;
    this.sparks = this.sparks.filter((s) => --s.life > 0);
    const frame = renderFight(this.arena, this.state, this.sparks);
    canvas.getContext('2d')!.putImageData(new ImageData(frame.toRgba(), frame.width, frame.height), 0, 0);
  }

  /** On your own PC you always play with the player 1 keys, whichever side you are on. */
  private key(e: KeyboardEvent, down: boolean): void {
    if (this.phase() !== 'fight') return;
    const k = this.keys;
    const codes = Object.values(k);
    if (!codes.includes(e.code)) return;
    e.preventDefault();
    if (e.code === k.left) this.left = down;
    if (e.code === k.right) this.right = down;
    if (e.code === k.up) this.up = down;
    if (e.code === k.down) this.down = down;
    const slot = ATTACK_SLOTS.find((s) => k[s] === e.code) ?? null;
    if (slot && (!down || e.repeat)) return;
    this.send({ type: 'input', left: this.left, right: this.right, up: this.up, down: this.down, press: slot });
  }

  private send(msg: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(msg));
  }
}
