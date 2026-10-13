import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { JsonFileStorage } from './file-storage';
import { emptyGameData } from './game-data';

describe('JsonFileStorage', () => {
  it('writes changes made during a write together, and always the newest state', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'southbeat-storage-'));
    try {
      const storage = new JsonFileStorage(join(dir, 'data.json'));
      const data = emptyGameData();
      const saves: Promise<void>[] = [];
      for (let i = 0; i < 50; i++) {
        data.matches.push({ id: `m${i}`, winnerId: 'a', loserId: 'b', arenaId: 'bunker', playedAt: '' });
        saves.push(storage.save(data));
      }
      await Promise.all(saves);
      const written = JSON.parse(await readFile(join(dir, 'data.json'), 'utf8'));
      assert.equal(written.matches.length, 50);
      assert.deepEqual(await storage.load(), written);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
