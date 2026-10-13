import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { defaultCharacter } from '../app/character/balance';
import { gameApi, GameApi } from './api';
import { JsonFileStorage } from './file-storage';

describe('game API over HTTP', () => {
  let dir: string;
  let server: Server;
  let api: GameApi;
  let base: string;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'southbeat-api-'));
    api = gameApi(new JsonFileStorage(join(dir, 'data.json')));
    const app = express();
    app.use('/api', api.router);
    await new Promise<void>((done) => (server = app.listen(0, done)));
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api`;
  });
  after(async () => {
    server.close();
    await rm(dir, { recursive: true, force: true });
  });

  const call = (path: string, method = 'GET', body?: unknown, token?: string): Promise<Response> =>
    fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Edit-Token': token } : {}) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });

  it('creates a fighter with a token that only its owner can use', async () => {
    const created = await call('/fighters', 'POST', { ...defaultCharacter(), name: 'Ada' });
    assert.equal(created.status, 201);
    const fighter = await created.json();
    assert.ok(fighter.editToken);

    assert.equal((await call(`/fighters/${fighter.id}`, 'PUT', { ...defaultCharacter(), name: 'Hijack' })).status, 403);
    assert.equal((await call(`/fighters/${fighter.id}`, 'PUT', { ...defaultCharacter(), name: 'Hijack' }, 'guess')).status, 403);
    const ok = await call(`/fighters/${fighter.id}`, 'PUT', { ...defaultCharacter(), name: 'Ada Lovelace' }, fighter.editToken);
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).name, 'Ada Lovelace');

    const list = await (await call('/fighters')).text();
    const one = await (await call(`/fighters/${fighter.id}`)).text();
    for (const text of [list, one]) {
      assert.ok(!text.includes(fighter.editToken));
      assert.ok(!text.includes('tokenHash'));
    }
    const file = await readFile(join(dir, 'data.json'), 'utf8');
    assert.ok(!file.includes(fighter.editToken), 'only the hash is stored');
  });

  it('checks the ladder order on the server', async () => {
    const f = await (await call('/fighters', 'POST', defaultCharacter())).json();
    assert.equal((await call(`/fighters/${f.id}/ladder`, 'POST', { opponentId: 'gustav-grossmaul', won: true }, f.editToken)).status, 403);
    assert.equal((await call(`/fighters/${f.id}/ladder`, 'POST', { opponentId: 'bernd-brummer', won: true }, f.editToken)).status, 201);
    assert.deepEqual((await (await call(`/fighters/${f.id}`)).json()).ladderBeaten, ['bernd-brummer']);
  });

  it('takes no match results from browsers, only from the online server for real owners', async () => {
    assert.equal((await call('/matches', 'POST', { winnerId: 'x', loserId: 'y', arenaId: 'bunker' })).status, 404);
    const a = await (await call('/fighters', 'POST', { ...defaultCharacter(), name: 'Winner' })).json();
    const b = await (await call('/fighters', 'POST', { ...defaultCharacter(), name: 'Loser' })).json();
    await api.recordOnline({ winner: { id: a.id, token: 'forged' }, loser: { id: b.id, token: b.editToken }, arenaId: 'bunker' });
    assert.equal((await (await call('/stats')).json()).matches, 0);
    await api.recordOnline({ winner: { id: a.id, token: a.editToken }, loser: { id: b.id, token: b.editToken }, arenaId: 'bunker' });
    const stats = await (await call('/stats')).json();
    assert.equal(stats.matches, 1);
    assert.equal(stats.leaderboard[0].name, 'Winner');
  });

  it('answers broken and oversized requests with errors, not crashes', async () => {
    assert.equal((await call('/fighters', 'POST', '{oops')).status, 400);
    assert.equal((await call('/fighters', 'POST', { name: 'x'.repeat(20_000) })).status, 413);
    assert.equal((await call('/fighters/nope')).status, 404);
  });

  it('limits how many fighters one address can create', async () => {
    let status = 0;
    for (let i = 0; i < 25 && status !== 429; i++) status = (await call('/fighters', 'POST', defaultCharacter())).status;
    assert.equal(status, 429);
  });
});
