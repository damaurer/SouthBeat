import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { GameData, emptyGameData } from './game-data';

/**
 * Keeps the game data in one JSON file. Writes go to a temporary file first and
 * are then renamed over the real one, so a crash never leaves a half-written file.
 * Writes are queued so two requests never write at the same time, and changes that come
 * in while a write is running are written together afterwards, so a busy server does not
 * write the whole file once per request.
 */
export class JsonFileStorage {
  private queue: Promise<void> = Promise.resolve();
  /** The next write, not started yet; later changes join it. */
  private pending: { data: GameData; done: Promise<void> } | null = null;

  constructor(readonly path: string) {}

  async load(): Promise<GameData> {
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8')) as GameData;
      if (data?.version !== 1 || !Array.isArray(data.fighters) || !Array.isArray(data.matches)) {
        throw new Error(`Unbekanntes Format in ${this.path}`);
      }
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyGameData();
      throw error;
    }
  }

  save(data: GameData): Promise<void> {
    if (this.pending) {
      this.pending.data = data;
      return this.pending.done;
    }
    const pending = { data, done: Promise.resolve() };
    const write = async (): Promise<void> => {
      // From here on, new changes wait for the next write.
      if (this.pending === pending) this.pending = null;
      const json = JSON.stringify(pending.data, null, 2);
      await mkdir(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.tmp`;
      await writeFile(tmp, json, 'utf8');
      await rename(tmp, this.path);
    };
    pending.done = this.queue = this.queue.then(write, write);
    this.pending = pending;
    return pending.done;
  }
}
