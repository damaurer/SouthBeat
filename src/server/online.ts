import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { characterErrors, defaultCharacter } from '../app/character/balance';
import { Character, MOVE_SLOTS, MoveSlot } from '../app/character/character.model';
import { ARENAS, findArena } from '../app/arena/arenas';
import { Controls, FPS, FightState, createFight, step } from '../app/fight/combat';
import { OWN_FIGHTER, builtInFighter } from '../app/select/roster';
import { ClientMessage, GameMode, LOBBY_NAME_MAX, LobbyInfo, ONLINE_PATH, ServerMessage, newRoomCode, normalizeCode, snapshotOf, stageSnapshotOf } from '../app/online/protocol';
import { Campaign, createCampaign, startStage, stepCampaign } from '../app/stage/campaign';
import { STAGES } from '../app/stage/stages';

interface Player {
  socket: WebSocket;
  character: Character;
  rosterId: string;
  fighterId: string | null;
  left: boolean;
  right: boolean;
  up: boolean;
  /** Set by any jump press, so a quick tap between two frames is not lost. */
  jumped: boolean;
  down: boolean;
  /** Attack buttons pressed since the last frame. */
  pressed: Set<MoveSlot>;
  wantsRematch: boolean;
}

interface Room {
  code: string;
  name: string;
  mode: GameMode;
  arenaId: string;
  players: Player[];
  state: FightState | null;
  /** The stage mode's run, played together by both players. */
  campaign: Campaign | null;
  /** Fighter ids whose characters the players already got in this stage. */
  known: Set<number>;
  knownRun: number;
  timer: ReturnType<typeof setInterval> | null;
}

/**
 * Online fights between two browsers, one on one or together in the stage mode. The server
 * runs the game and is the only one that decides what happens; the browsers send their key presses and draw the frames
 * they get back. That way both players always see the same fight.
 */
export class OnlineServer {
  private readonly rooms = new Map<string, Room>();
  /** Connections not in a room yet; they get the lobby table whenever it changes. */
  private readonly browsing = new Set<WebSocket>();

  constructor(private readonly random: () => number = Math.random) {}

  attach(server: Server): WebSocketServer {
    const wss = new WebSocketServer({ server, path: ONLINE_PATH, maxPayload: 16 * 1024 });
    wss.on('connection', (socket) => this.connect(socket));
    return wss;
  }

  connect(socket: WebSocket): void {
    let room: Room | null = null;
    let player: Player | null = null;
    this.browsing.add(socket);
    send(socket, { type: 'lobbies', lobbies: this.lobbies() });
    socket.on('message', (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (msg.type === 'create' && !room) {
        player = this.player(socket, msg.rosterId, msg.fighter, msg.fighterId);
        room = this.create(player, msg.name, msg.mode, msg.arenaId);
        this.browsing.delete(socket);
        this.announce();
      } else if (msg.type === 'join' && !room) {
        const found = this.rooms.get(normalizeCode(String(msg.code ?? '')));
        if (!found) return send(socket, { type: 'error', message: 'Diesen Raum gibt es nicht.' });
        if (found.players.length >= 2) return send(socket, { type: 'error', message: 'Der Raum ist schon voll.' });
        player = this.player(socket, msg.rosterId, msg.fighter, msg.fighterId);
        room = found;
        room.players.push(player);
        this.browsing.delete(socket);
        this.announce();
        this.start(room);
      } else if (msg.type === 'input' && player) {
        player.left = msg.left === true;
        player.right = msg.right === true;
        player.up = msg.up === true;
        if (player.up) player.jumped = true;
        player.down = msg.down === true;
        if (MOVE_SLOTS.includes(msg.press as MoveSlot)) player.pressed.add(msg.press as MoveSlot);
      } else if (msg.type === 'rematch' && room && player && this.finished(room)) {
        player.wantsRematch = true;
        const by = room.players.indexOf(player) as 0 | 1;
        room.players.forEach((p) => send(p.socket, { type: 'rematch-wanted', by }));
        if (room.players.length === 2 && room.players.every((p) => p.wantsRematch)) this.start(room);
      }
    });
    socket.on('close', () => {
      this.browsing.delete(socket);
      if (!room) return;
      this.stop(room);
      this.rooms.delete(room.code);
      room.players.filter((p) => p !== player).forEach((p) => send(p.socket, { type: 'opponent-left' }));
      this.announce();
    });
  }

  roomCount(): number {
    return this.rooms.size;
  }

  /** Rooms that still wait for a second player, newest first. */
  lobbies(): LobbyInfo[] {
    return [...this.rooms.values()]
      .filter((r) => r.players.length === 1)
      .reverse()
      .map((r) => ({ code: r.code, name: r.name, host: r.players[0].character.name, mode: r.mode, arenaId: r.arenaId }));
  }

  private announce(): void {
    const msg: ServerMessage = { type: 'lobbies', lobbies: this.lobbies() };
    this.browsing.forEach((s) => send(s, msg));
  }

  private player(socket: WebSocket, rosterId: unknown, fighter: unknown, fighterId: unknown): Player {
    // Built-in fighters come from the server's own list; the player's own fighter is checked
    // like a saved one, so nobody brings an overpowered fighter online.
    const builtIn = typeof rosterId === 'string' && rosterId !== OWN_FIGHTER ? builtInFighter(rosterId) : undefined;
    const valid = fighter && typeof fighter === 'object' && characterErrors(fighter as Character).length === 0;
    return {
      socket,
      character: builtIn ? builtIn.character : valid ? (fighter as Character) : defaultCharacter(),
      rosterId: builtIn ? builtIn.id : OWN_FIGHTER,
      // Only the player's own fighter counts in the statistics.
      fighterId: !builtIn && typeof fighterId === 'string' ? fighterId : null,
      left: false,
      right: false,
      up: false,
      jumped: false,
      down: false,
      pressed: new Set(),
      wantsRematch: false,
    };
  }

  private create(host: Player, name: unknown, mode: unknown, arenaId: unknown): Room {
    let code = newRoomCode(this.random);
    while (this.rooms.has(code)) code = newRoomCode(this.random);
    const stage = mode === 'stage';
    // The stage mode goes through the stages' own arenas, so the host picks none.
    const arena = stage
      ? STAGES[0].arenaId
      : typeof arenaId === 'string' && findArena(arenaId).id === arenaId
        ? arenaId
        : ARENAS[Math.floor(this.random() * ARENAS.length)].id;
    const clean = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, LOBBY_NAME_MAX) : '';
    const room: Room = {
      code,
      name: clean || `Lobby von ${host.character.name}`,
      mode: stage ? 'stage' : 'duel',
      arenaId: arena,
      players: [host],
      state: null,
      campaign: null,
      known: new Set(),
      knownRun: 0,
      timer: null,
    };
    this.rooms.set(code, room);
    send(host.socket, { type: 'room', code, name: room.name, mode: room.mode, arenaId: arena });
    return room;
  }

  /** A fight has a winner, or the stage run is lost or won: time for a rematch or a retry. */
  private finished(room: Room): boolean {
    if (room.mode === 'stage') return !!room.campaign && (room.campaign.won || room.campaign.state.phase === 'gameover');
    return room.state?.winner != null;
  }

  private start(room: Room): void {
    this.stop(room);
    const [a, b] = room.players;
    if (room.mode === 'stage') {
      room.knownRun = 0;
      const c = room.campaign;
      if (c && !c.won) startStage(c, c.state.stage.index);
      else room.campaign = createCampaign([a, b].map((p) => ({ character: p.character, brain: 'human' as const })));
    } else {
      room.state = createFight(a.character, b.character, room.arenaId);
    }
    room.players.forEach((p, i) => {
      p.wantsRematch = false;
      p.pressed.clear();
      send(p.socket, {
        type: 'start',
        mode: room.mode,
        you: i as 0 | 1,
        arenaId: room.arenaId,
        characters: [a.character, b.character],
        rosterIds: [a.rosterId, b.rosterId],
        fighterIds: [a.fighterId, b.fighterId],
      });
    });
    if (room.mode === 'stage') return this.runStage(room);
    // Frames are stepped by elapsed time, so a late timer catches up instead of slowing the fight.
    const startedAt = Date.now();
    room.timer = setInterval(() => {
      const state = room.state!;
      const due = Math.floor(((Date.now() - startedAt) * FPS) / 1000);
      let events = [] as typeof state.events;
      while (state.frame < due && state.winner === null) {
        step(state, [this.controls(a), this.controls(b)]);
        events = events.concat(state.events);
      }
      state.events = events;
      const snapshot = JSON.stringify({ type: 'state', snapshot: snapshotOf(state) } satisfies ServerMessage);
      room.players.forEach((p) => p.socket.readyState === WebSocket.OPEN && p.socket.send(snapshot));
      if (state.winner !== null) this.stop(room);
    }, 1000 / FPS);
  }

  private runStage(room: Room): void {
    const c = room.campaign!;
    const [a, b] = room.players;
    const startedAt = Date.now();
    let frames = 0;
    room.timer = setInterval(() => {
      const due = Math.floor(((Date.now() - startedAt) * FPS) / 1000);
      let events = [] as typeof c.state.events;
      while (frames < due && !this.finished(room)) {
        const run = c.run;
        stepCampaign(c, [this.controls(a), this.controls(b)], this.random);
        frames++;
        // Events of a stage that just ended refer to its fighters, so they are dropped.
        events = run === c.run ? events.concat(c.state.events) : [];
      }
      c.state.events = events;
      if (room.knownRun !== c.run) {
        room.knownRun = c.run;
        room.known.clear();
      }
      const snapshot = JSON.stringify({ type: 'stage', snapshot: stageSnapshotOf(c, room.known) } satisfies ServerMessage);
      room.players.forEach((p) => p.socket.readyState === WebSocket.OPEN && p.socket.send(snapshot));
      if (this.finished(room)) this.stop(room);
    }, 1000 / FPS);
  }

  private controls(p: Player): Controls {
    const c: Controls = {
      left: p.left,
      right: p.right,
      up: p.up || p.jumped,
      down: p.down,
      light: p.pressed.has('light'),
      heavy: p.pressed.has('heavy'),
      kick: p.pressed.has('kick'),
      special: p.pressed.has('special'),
      ultimate: p.pressed.has('ultimate'),
    };
    p.pressed.clear();
    p.jumped = false;
    return c;
  }

  private stop(room: Room): void {
    if (room.timer) clearInterval(room.timer);
    room.timer = null;
  }
}

function send(socket: WebSocket, msg: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}
