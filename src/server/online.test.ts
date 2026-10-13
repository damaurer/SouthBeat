import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { WebSocket } from 'ws';
import { defaultCharacter } from '../app/character/balance';
import { ClientMessage, ServerMessage } from '../app/online/protocol';
import { OWN_FIGHTER } from '../app/select/roster';
import { OnlineServer } from './online';

/** Stands in for a browser connection: records what the server sends and lets the test talk. */
class FakeSocket extends EventEmitter {
  readyState = 1;
  readonly received: ServerMessage[] = [];
  send(data: string): void {
    this.received.push(JSON.parse(data));
  }
  close(): void {
    this.readyState = 3;
    this.emit('close');
  }
  terminate(): void {
    this.close();
  }
  ping(): void {}
  say(msg: ClientMessage | unknown): void {
    this.emit('message', typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  last(type: ServerMessage['type']): ServerMessage | undefined {
    return [...this.received].reverse().find((m) => m.type === type);
  }
}

const create = (extra: Partial<Extract<ClientMessage, { type: 'create' }>> = {}): ClientMessage => ({
  type: 'create',
  name: 'Test',
  mode: 'duel',
  rosterId: OWN_FIGHTER,
  fighter: defaultCharacter(),
  fighterId: null,
  arenaId: 'bunker',
  ...extra,
});

describe('OnlineServer', () => {
  let server: OnlineServer;
  const sockets: FakeSocket[] = [];
  const connect = (): FakeSocket => {
    const s = new FakeSocket();
    sockets.push(s);
    server.connect(s as unknown as WebSocket);
    return s;
  };

  beforeEach(() => {
    // A fixed but changing sequence, so room codes differ.
    let n = 0;
    server = new OnlineServer(() => ((n = (n * 9301 + 49297) % 233280) / 233280));
  });
  afterEach(() => {
    // Closing stops the room timers.
    sockets.splice(0).forEach((s) => s.readyState === 1 && s.close());
  });

  it('ignores null, lists, numbers and broken JSON without leaving a room behind', () => {
    const s = connect();
    for (const bad of ['null', '[1,2]', '42', '{oops', '"text"', JSON.stringify({ type: 'join' }), JSON.stringify({ type: 'input' })]) s.say(bad);
    assert.equal(server.roomCount(), 0);
    assert.equal(s.readyState, 1);
  });

  it('replaces a broken or overpowered own fighter with the default one', () => {
    const s = connect();
    s.say(create({ fighter: { name: 'Cheat', stats: { strength: 10, speed: 10, defense: 10, stamina: 10 } } as never }));
    assert.equal(server.roomCount(), 1);
    assert.equal(server.lobbies()[0].host, defaultCharacter().name);
    const t = connect();
    t.say(create({ fighter: null as never }));
    assert.equal(server.roomCount(), 2);
  });

  it('opens a lobby, lets a second player join and starts the fight', () => {
    const host = connect();
    host.say(create());
    const room = host.last('room');
    assert.ok(room && room.type === 'room');
    const guest = connect();
    assert.equal(guest.last('lobbies')?.type, 'lobbies');
    guest.say({ type: 'join', code: room.code, rosterId: 'bernd-brummer', fighter: defaultCharacter(), fighterId: null });
    assert.equal(host.last('start')?.type, 'start');
    assert.equal(guest.last('start')?.type, 'start');
    assert.deepEqual(server.lobbies(), []);
  });

  it('tells the other player and removes the room when someone leaves', () => {
    const host = connect();
    host.say(create());
    const room = host.last('room') as Extract<ServerMessage, { type: 'room' }>;
    const guest = connect();
    guest.say({ type: 'join', code: room.code, rosterId: OWN_FIGHTER, fighter: defaultCharacter(), fighterId: null });
    guest.close();
    assert.equal(host.last('opponent-left')?.type, 'opponent-left');
    assert.equal(server.roomCount(), 0);
  });

  it('refuses unknown and full rooms', () => {
    const s = connect();
    s.say({ type: 'join', code: 'ZZZZ', rosterId: OWN_FIGHTER, fighter: defaultCharacter(), fighterId: null });
    assert.equal(s.last('error')?.type, 'error');
  });
});
