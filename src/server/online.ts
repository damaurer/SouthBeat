import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { characterErrors, defaultCharacter } from '../app/character/balance';
import { Character, MOVE_SLOTS, MoveSlot } from '../app/character/character.model';
import { ARENAS, findArena } from '../app/arena/arenas';
import { Controls, FPS, FightState, createFight, step } from '../app/fight/combat';
import { OWN_FIGHTER, builtInFighter } from '../app/select/roster';
import { ClientMessage, ONLINE_PATH, ServerMessage, newRoomCode, normalizeCode, snapshotOf } from '../app/online/protocol';

interface Player {
  socket: WebSocket;
  character: Character;
  rosterId: string;
  fighterId: string | null;
  left: boolean;
  right: boolean;
  /** Attack buttons pressed since the last frame. */
  pressed: Set<MoveSlot>;
  wantsRematch: boolean;
}

interface Room {
  code: string;
  arenaId: string;
  players: Player[];
  state: FightState | null;
  timer: ReturnType<typeof setInterval> | null;
}

/**
 * Online fights between two browsers. The server runs the fight engine and is the only
 * one that decides what happens; the browsers send their key presses and draw the frames
 * they get back. That way both players always see the same fight.
 */
export class OnlineServer {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly random: () => number = Math.random) {}

  attach(server: Server): WebSocketServer {
    const wss = new WebSocketServer({ server, path: ONLINE_PATH, maxPayload: 16 * 1024 });
    wss.on('connection', (socket) => this.connect(socket));
    return wss;
  }

  connect(socket: WebSocket): void {
    let room: Room | null = null;
    let player: Player | null = null;
    socket.on('message', (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (msg.type === 'create' && !room) {
        player = this.player(socket, msg.rosterId, msg.fighter, msg.fighterId);
        room = this.create(player, msg.arenaId);
      } else if (msg.type === 'join' && !room) {
        const found = this.rooms.get(normalizeCode(String(msg.code ?? '')));
        if (!found) return send(socket, { type: 'error', message: 'Diesen Raum gibt es nicht.' });
        if (found.players.length >= 2) return send(socket, { type: 'error', message: 'Der Raum ist schon voll.' });
        player = this.player(socket, msg.rosterId, msg.fighter, msg.fighterId);
        room = found;
        room.players.push(player);
        this.start(room);
      } else if (msg.type === 'input' && player) {
        player.left = msg.left === true;
        player.right = msg.right === true;
        if (MOVE_SLOTS.includes(msg.press as MoveSlot)) player.pressed.add(msg.press as MoveSlot);
      } else if (msg.type === 'rematch' && room && player && room.state?.winner != null) {
        player.wantsRematch = true;
        const by = room.players.indexOf(player) as 0 | 1;
        room.players.forEach((p) => send(p.socket, { type: 'rematch-wanted', by }));
        if (room.players.length === 2 && room.players.every((p) => p.wantsRematch)) this.start(room);
      }
    });
    socket.on('close', () => {
      if (!room) return;
      this.stop(room);
      this.rooms.delete(room.code);
      room.players.filter((p) => p !== player).forEach((p) => send(p.socket, { type: 'opponent-left' }));
    });
  }

  roomCount(): number {
    return this.rooms.size;
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
      pressed: new Set(),
      wantsRematch: false,
    };
  }

  private create(host: Player, arenaId: unknown): Room {
    let code = newRoomCode(this.random);
    while (this.rooms.has(code)) code = newRoomCode(this.random);
    const arena = typeof arenaId === 'string' && findArena(arenaId).id === arenaId ? arenaId : ARENAS[Math.floor(this.random() * ARENAS.length)].id;
    const room: Room = { code, arenaId: arena, players: [host], state: null, timer: null };
    this.rooms.set(code, room);
    send(host.socket, { type: 'room', code });
    return room;
  }

  private start(room: Room): void {
    this.stop(room);
    const [a, b] = room.players;
    room.state = createFight(a.character, b.character, room.arenaId);
    room.players.forEach((p, i) => {
      p.wantsRematch = false;
      p.pressed.clear();
      send(p.socket, {
        type: 'start',
        you: i as 0 | 1,
        arenaId: room.arenaId,
        characters: [a.character, b.character],
        rosterIds: [a.rosterId, b.rosterId],
        fighterIds: [a.fighterId, b.fighterId],
      });
    });
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

  private controls(p: Player): Controls {
    const c: Controls = {
      left: p.left,
      right: p.right,
      light: p.pressed.has('light'),
      heavy: p.pressed.has('heavy'),
      kick: p.pressed.has('kick'),
      special: p.pressed.has('special'),
      ultimate: p.pressed.has('ultimate'),
    };
    p.pressed.clear();
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
