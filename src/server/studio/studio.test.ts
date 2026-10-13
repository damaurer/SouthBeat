import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import http, { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { clearContent, installedContent } from '../../app/content/content';
import { findArena } from '../../app/arena/arenas';
import { ContentFiles } from '../content-files';
import { StudioSettings } from './settings';
import { loadContent, studioApi } from './studio-api';

const example = async (): Promise<Record<string, unknown>> => {
  const pack = JSON.parse(await readFile('content/examples/netzwerk-pack.json', 'utf8'));
  delete pack.$schema;
  return pack;
};

/** An OpenAI-compatible fake: first a broken pack, after the error report the good one. */
function fakeLlm(good: Record<string, unknown>): { server: Server; seen: { auth?: string; messages: number }[] } {
  const seen: { auth?: string; messages: number }[] = [];
  const bad = structuredClone(good) as { moves: { damage: number; startupFrames: number }[] };
  bad.moves[1].damage = 36;
  bad.moves[1].startupFrames = 10;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const json = JSON.parse(body);
      seen.push({ auth: req.headers.authorization, messages: json.messages.length });
      const tools = json.messages.filter((m: { role: string }) => m.role === 'tool');
      const call = (name: string, pack: unknown) => ({ role: 'assistant', content: '', tool_calls: [{ id: `c${tools.length}`, type: 'function', function: { name, arguments: JSON.stringify({ pack }) } }] });
      const message =
        tools.length === 0 ? call('validate_pack', bad) : String(tools.at(-1).content).startsWith('Fehler') ? call('submit_pack', good) : { role: 'assistant', content: 'Fertig gebaut.' };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message }] }));
    });
  });
  return { server, seen };
}

describe('content studio API', () => {
  let dir: string;
  const servers: Server[] = [];
  let llm: ReturnType<typeof fakeLlm>;
  let base: string;
  let llmUrl: string;

  const listen = (server: Server): Promise<string> => {
    servers.push(server);
    return new Promise((done) => server.listen(0, '127.0.0.1', () => done(`http://127.0.0.1:${(server.address() as { port: number }).port}`)));
  };

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'southbeat-studio-'));
    await mkdir(join(dir, 'shipped'));
    llm = fakeLlm(await example());
    llmUrl = await listen(llm.server);
    const files = new ContentFiles(join(dir, 'shipped'), join(dir, 'studio'));
    const e = express();
    e.use('/api', studioApi({ files, settings: new StudioSettings(join(dir, 'settings.json'), {}) }));
    base = `${await listen(http.createServer(e))}/api`;
  });
  after(async () => {
    for (const s of servers) {
      s.closeAllConnections();
      s.close();
    }
    clearContent();
    await rm(dir, { recursive: true, force: true });
  });

  const call = (path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}): Promise<Response> =>
    fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });

  it('keeps the API key on the server', async () => {
    const saved = await (await call('/studio/settings', 'PUT', { provider: 'openai', baseUrl: `${llmUrl}/v1`, model: 'fake', apiKey: 'sk-secret' })).json();
    assert.equal(saved.hasKey, true);
    assert.ok(!JSON.stringify(saved).includes('sk-secret'));
    assert.ok(!(await (await call('/studio/settings')).text()).includes('sk-secret'));
    assert.equal((await call('/studio/settings', 'PUT', { provider: 'openai', baseUrl: 'ftp://x' })).status, 400);
  });

  it('lets the agent fix its pack until the rules accept it, without saving anything', async () => {
    const reply = await (await call('/studio/chat', 'POST', { message: 'Ein Netzwerk-Keller bitte' })).json();
    assert.equal(reply.text, 'Fertig gebaut.');
    assert.deepEqual(reply.steps, ['Prüfung: 1 Fehler, wird korrigiert', 'Paket eingereicht']);
    assert.equal(reply.draft.id, 'netzwerk-pack');
    assert.deepEqual(reply.errors, []);
    assert.equal(llm.seen[0].auth, 'Bearer sk-secret');
    assert.deepEqual(installedContent(), []);
  });

  it('saves a confirmed pack, puts it into the game and removes it again', async () => {
    const pack = await example();
    assert.equal((await call('/studio/packs', 'POST', { pack: { ...pack, moves: [] } })).status, 400);
    const saved = await (await call('/studio/packs', 'POST', { pack })).json();
    assert.deepEqual(saved.installed, ['netzwerk-pack']);
    assert.equal(findArena('netzwerk-keller').id, 'netzwerk-keller');
    assert.deepEqual(await (await call('/content')).json().then((p: { id: string }[]) => p.map((x) => x.id)), ['netzwerk-pack']);
    await call('/studio/packs/netzwerk-pack', 'DELETE');
    assert.deepEqual(installedContent(), []);
  });

  it('never overwrites a pack that ships with the game', async () => {
    const pack = await example();
    await writeFile(join(dir, 'shipped', 'netzwerk-pack.json'), JSON.stringify(pack));
    await loadContent(new ContentFiles(join(dir, 'shipped'), join(dir, 'studio')));
    const res = await call('/studio/packs', 'POST', { pack: { ...pack, name: 'Überschrieben' } });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /gehört zum Spiel/);
  });

  it('asks for the password when one is set', async () => {
    const e = express();
    e.use('/api', studioApi({ files: new ContentFiles(join(dir, 'shipped'), join(dir, 'studio')), settings: new StudioSettings(join(dir, 's2.json'), {}), password: 'geheim' }));
    const url = `${await listen(http.createServer(e))}/api`;
    assert.equal((await fetch(`${url}/studio/settings`)).status, 401);
    assert.equal((await fetch(`${url}/studio/settings`, { headers: { 'X-Studio-Password': 'falsch!' } })).status, 401);
    assert.equal((await fetch(`${url}/studio/settings`, { headers: { 'X-Studio-Password': 'geheim' } })).status, 200);
    assert.equal((await fetch(`${url}/content`)).status, 200);
  });
});
