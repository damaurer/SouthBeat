import { Component, DestroyRef, ElementRef, NgZone, effect, inject, signal, viewChild } from '@angular/core';
import { Sound } from '../shared/sound';
import { Pads } from '../shared/pads';
import { TouchControls } from '../shared/touch-controls';
import { roundBanner } from '../fight/rounds';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CharacterStore } from '../character/character-store';
import { Character } from '../character/character.model';
import { ARENAS, findArena, paintArena } from '../arena/arenas';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../arena/props';
import { Painter, seeded } from '../arena/painter';
import { FightState, METER_MAX, ROUND_FRAMES, FPS } from '../fight/combat';
import { ATTACK_SLOTS, KeyMap } from '../fight/controls';
import { KeyBindings } from '../fight/key-bindings';
import { HIT_LINES, HIT_LINE_COOLDOWN, LineDeck, saysSomething } from '../fight/hit-lines';
import { Effects } from '../fight/effects';
import { fightEffects, renderFight } from '../fight/render';
import { CharacterSelect, FighterPicks } from '../select/character-select';
import { FighterPortrait } from '../select/fighter-portrait';
import { RosterEntry, builtInFighter, resolvePick, roster } from '../select/roster';
import { StageScreen } from '../stage/stage-screen';
import { STAGES } from '../stage/stages';
import {
  ClientMessage,
  FightSnapshot,
  GAME_MODES,
  GameMode,
  LOBBY_NAME_MAX,
  LobbyInfo,
  ONLINE_PATH,
  RECONNECT_MS,
  ServerMessage,
  StageSnapshot,
  decodeMessage,
  normalizeCode,
  stageFrom,
  stateFrom,
} from './protocol';

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
 * Online games between two PCs. The host opens a lobby for a one-on-one fight or for the
 * co-op stage mode, the other player joins it from the lobby table (or with the code).
 * The server runs the game; this page sends key presses and draws what comes back.
 */
@Component({
  selector: 'app-online-page',
  imports: [RouterLink, FormsModule, CharacterSelect, FighterPortrait, StageScreen, TouchControls],
  templateUrl: './online-page.html',
  styleUrls: ['../fight/fight-page.scss', './online-page.scss'],
})
export class OnlinePage {
  private readonly store = inject(CharacterStore);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly stageScreen = viewChild(StageScreen);

  protected readonly arenas = ARENAS;
  protected readonly modes = GAME_MODES;
  protected readonly stageCount = STAGES.length;
  /** What the host's new lobby plays. */
  protected readonly mode = signal<GameMode>('duel');
  /** What the current room plays. */
  protected readonly matchMode = signal<GameMode>('duel');
  private readonly bindings = inject(KeyBindings);
  /** Online you always play with your player 1 keys, as set up on this PC. */
  protected get keys(): KeyMap {
    return this.bindings.keys()[0];
  }
  protected readonly keyName = (code: string): string => this.bindings.name(code);
  protected readonly width = ARENA_WIDTH;
  protected readonly height = ARENA_HEIGHT;
  protected readonly meterMax = METER_MAX;

  protected readonly phase = signal<Phase>('menu');
  protected readonly error = signal<string | null>(null);
  protected readonly code = signal('');
  protected readonly arenaName = signal('');
  protected readonly roomName = signal('');
  protected readonly you = signal<0 | 1>(0);
  protected readonly fighters = signal<[FighterHud, FighterHud] | null>(null);
  protected readonly seconds = signal(99);
  protected readonly wins = signal<[number, number]>([0, 0]);
  protected readonly call = signal<string | null>(null);
  private readonly sound = inject(Sound);
  private readonly pads = inject(Pads);
  /** Directions held on a gamepad or the touch controls. */
  private padDirs = { left: false, right: false, up: false, down: false };
  protected readonly bubbles = signal<[Bubble | null, Bubble | null]>([null, null]);
  protected readonly banner = signal<string | null>(null);
  protected readonly result = signal<string | null>(null);
  protected readonly rematchBy = signal<(0 | 1)[]>([]);
  /** A dropped connection, ours or the opponent's, while the game waits. */
  protected readonly notice = signal<string | null>(null);
  /** Lets this page take its seat again after a dropped connection. */
  private resume: { code: string; token: string } | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private giveUpAt = 0;
  private gone = false;

  /** The fighter picked on the select screen; null until one is picked. */
  protected readonly chosen = signal<RosterEntry | null>(null);
  private readonly router = inject(Router);
  protected readonly lobbies = signal<LobbyInfo[]>([]);
  protected readonly lobbyName = signal('');
  protected readonly connected = signal(false);
  protected readonly nameMax = LOBBY_NAME_MAX;
  protected joinCode = '';
  private pending: ClientMessage | null = null;
  protected arenaId = '';

  private socket: WebSocket | null = null;
  private characters: [Character, Character] | null = null;
  private arena: Painter | null = null;
  /** Stage mode: characters of everyone on the stage, sent once by the server. */
  private cast = new Map<number, Character>();
  private stageRun = 0;
  private recordedRun = 0;
  private state: FightState | null = null;
  private matchArena = '';
  private readonly fx = new Effects();
  private bannerUntil = 0;
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
    // Closing the tab is leaving on purpose; only a dropped connection gets the wait.
    const onHide = (): void => this.send({ type: 'leave' });
    let raf = 0;
    const loop = (): void => {
      this.readPads();
      this.draw();
      raf = requestAnimationFrame(loop);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onDown);
      window.addEventListener('keyup', onUp);
      window.addEventListener('pagehide', onHide);
      inject(NgZone).runOutsideAngular(() => (raf = requestAnimationFrame(loop)));
    }
    destroyRef.onDestroy(() => {
      this.gone = true;
      if (this.retry) clearTimeout(this.retry);
      this.send({ type: 'leave' });
      this.socket?.close();
      if (typeof window === 'undefined') return;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('pagehide', onHide);
    });
    // The canvas only exists during the fight, so the arena is painted once it appears.
    effect(() => {
      if (this.canvas() && this.state) this.draw();
    });
  }

  protected choose(picks: FighterPicks): void {
    const entries = roster(this.store.saved(), this.store.ladderBeaten());
    this.chosen.set(resolvePick(picks.p1, entries, seeded(Date.now())));
    this.open();
  }

  protected home(): void {
    void this.router.navigate(['/']);
  }

  protected lobbyArena(l: LobbyInfo): string {
    return l.mode === 'stage' ? `alle ${STAGES.length} Stages` : findArena(l.arenaId).name;
  }

  /** The host names the lobby and picks the arena; the guest only brings a fighter. */
  protected create(): void {
    this.request({ type: 'create', name: this.lobbyName(), mode: this.mode(), ...this.myFighter(), arenaId: this.arenaId });
  }

  protected joinLobby(lobby: LobbyInfo): void {
    this.request({ type: 'join', code: lobby.code, ...this.myFighter() });
  }

  private myFighter(): { rosterId: string; fighter: Character; fighterId: string | null; editToken: string | null } {
    const c = this.chosen()!;
    return { rosterId: c.id, fighter: c.character, fighterId: this.store.fighterId(), editToken: this.store.editToken() };
  }

  protected join(): void {
    const code = normalizeCode(this.joinCode);
    if (code.length !== 4) {
      this.error.set('Der Raumcode hat vier Buchstaben.');
      return;
    }
    this.request({ type: 'join', code, ...this.myFighter() });
  }

  protected rematch(): void {
    this.send({ type: 'rematch' });
  }

  protected leave(): void {
    this.resume = null;
    this.notice.set(null);
    if (this.retry) clearTimeout(this.retry);
    this.send({ type: 'leave' });
    this.socket?.close();
    this.socket = null;
    this.state = null;
    this.phase.set('menu');
    this.open();
  }

  /** Sends a message, opening the connection first if needed. */
  private request(msg: ClientMessage): void {
    this.error.set(null);
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    } else {
      this.pending = msg;
      this.open();
    }
  }

  /** Connects to the game server; while in the menu it keeps the lobby table up to date. */
  protected open(): void {
    if (typeof WebSocket === 'undefined' || (this.socket && this.socket.readyState <= WebSocket.OPEN)) return;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${location.host}${ONLINE_PATH}`);
    this.socket = socket;
    socket.onopen = () => {
      this.connected.set(true);
      if (this.pending) socket.send(JSON.stringify(this.pending));
      this.pending = null;
    };
    socket.onmessage = (e) => this.receive(decodeMessage(String(e.data)));
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.connected.set(false);
      if (this.phase() === 'fight' && this.resume && !this.gone) return this.reconnect();
      if (this.phase() === 'waiting' || this.phase() === 'menu') {
        this.phase.set('menu');
        this.error.set('Keine Verbindung zum Spielserver. Läuft der SouthBeat-Server?');
      }
    };
  }

  /** The connection dropped mid-game: the server keeps the seat for a while, so knock again. */
  private reconnect(): void {
    const now = Date.now();
    if (!this.giveUpAt) this.giveUpAt = now + RECONNECT_MS;
    if (now > this.giveUpAt) {
      this.giveUpAt = 0;
      this.resume = null;
      this.notice.set(null);
      this.phase.set('left');
      this.error.set('Die Verbindung zum Spielserver ist weg.');
      return;
    }
    this.notice.set('Verbindung verloren, verbinde neu …');
    this.retry = setTimeout(() => {
      this.retry = null;
      if (this.gone || !this.resume) return;
      this.pending = { type: 'resume', ...this.resume };
      this.open();
    }, 1000);
  }

  private receive(msg: ServerMessage): void {
    switch (msg.type) {
      case 'lobbies':
        this.lobbies.set(msg.lobbies);
        break;
      case 'room':
        this.code.set(msg.code);
        this.resume = { code: msg.code, token: msg.resume };
        this.roomName.set(msg.name);
        this.matchMode.set(msg.mode);
        this.arenaName.set(msg.mode === 'stage' ? `alle ${STAGES.length} Stages` : findArena(msg.arenaId).name);
        this.phase.set('waiting');
        break;
      case 'error':
        if (this.phase() === 'fight') {
          // The game we tried to come back to is over.
          this.resume = null;
          this.notice.set(null);
          this.giveUpAt = 0;
          this.phase.set('left');
          return;
        }
        // The connection stays open, so the lobby table keeps updating.
        this.error.set(msg.message);
        this.phase.set('menu');
        break;
      case 'start': {
        this.code.set(msg.code);
        this.resume = { code: msg.code, token: msg.resume };
        this.giveUpAt = 0;
        this.notice.set(null);
        this.matchArena = msg.arenaId;
        this.matchMode.set(msg.mode);
        this.cast = new Map();
        this.stageRun = 0;
        this.recordedRun = 0;
        this.characters = msg.characters;
        this.you.set(msg.you);
        const arena = findArena(msg.arenaId);
        this.arena = paintArena(arena);
        this.arenaName.set(arena.name);
        this.state = null;
        this.fx.clear();
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
      case 'stage':
        this.applyStage(msg.snapshot);
        break;
      case 'rematch-wanted':
        this.rematchBy.update((by) => (by.includes(msg.by) ? by : [...by, msg.by]));
        break;
      case 'opponent-away':
        this.notice.set(`Verbindung des Gegners unterbrochen. Das Spiel wartet bis zu ${msg.seconds} Sekunden.`);
        break;
      case 'opponent-back':
        this.notice.set(null);
        break;
      case 'opponent-left':
        this.resume = null;
        this.notice.set(null);
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
    fightEffects(this.fx, state);
    for (const e of state.events) {
      if (e.type === 'hit') {
        this.reactToHit((1 - e.attacker) as 0 | 1, e.slot);
        this.sound.hit(e.slot);
      } else if (e.type === 'block') {
        this.sound.play('block');
      } else if (e.type === 'ultimate') {
        this.banner.set(`${this.characters[e.fighter].name}: ${e.move.name}!`);
        this.bannerUntil = state.frame + 90;
        this.sound.play('ultimate');
      }
    }
    const call = roundBanner(state);
    if (call !== this.call()) {
      if (call === 'FIGHT!') this.sound.play('fight');
      else if (call?.startsWith('Runde') || call === 'Finale Runde') this.sound.play('round');
      else if (call === 'K.O.!' || call === 'Zeit!') this.sound.play('ko');
      this.call.set(call);
    }
    this.wins.set(state.wins);
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

  private applyStage(snapshot: StageSnapshot): void {
    if (snapshot.run !== this.stageRun) {
      this.stageRun = snapshot.run;
      this.cast.clear();
    }
    const state = stageFrom(snapshot, this.cast);
    // Everyone records a beaten boss for their own fighter, as in the local stage mode.
    if (state.phase === 'cleared' && this.recordedRun !== snapshot.run) {
      this.recordedRun = snapshot.run;
      void this.store.recordLadder(state.stage.boss.id, true);
    }
    if (snapshot.won) {
      this.result.set(`Alle ${STAGES.length} Stages geschafft!`);
      return;
    }
    this.stageScreen()?.show(state, snapshot.run);
    this.result.set(state.phase === 'gameover' ? 'Game Over' : null);
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
    // The server itself counts the result for the statistics.
  }

  private draw(): void {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas || !this.state || !this.arena) return;
    const frame = renderFight(this.arena, this.state, this.fx);
    canvas.getContext('2d')!.putImageData(new ImageData(frame.toRgba(), frame.width, frame.height), 0, 0);
  }

  /** On your own PC you always play with the player 1 keys, whichever side you are on. */
  private key(e: KeyboardEvent, down: boolean): void {
    if (this.phase() !== 'fight') return;
    if (this.result() && this.matchMode() === 'stage') return;
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
    this.sendInput(slot);
  }

  private sendInput(press: (typeof ATTACK_SLOTS)[number] | null): void {
    const d = this.padDirs;
    this.send({ type: 'input', left: this.left || d.left, right: this.right || d.right, up: this.up || d.up, down: this.down || d.down, press });
  }

  /** Gamepad 1 and the touch controls play for you online. */
  private readPads(): void {
    if (this.phase() !== 'fight') return;
    this.pads.poll();
    const c = this.pads.controls(0);
    const dirs = { left: c.left, right: c.right, up: c.up, down: c.down };
    const changed = (Object.keys(dirs) as (keyof typeof dirs)[]).some((k) => dirs[k] !== this.padDirs[k]);
    this.padDirs = dirs;
    const press = ATTACK_SLOTS.find((s) => c[s]) ?? null;
    if (changed || press) this.sendInput(press);
    this.pads.consumed();
  }

  private send(msg: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(msg));
  }
}
