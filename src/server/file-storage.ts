import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { GameData, emptyGameData } from './game-data';

/**
 * Keeps the game data in one JSON file. Writes go to a temporary file first and
 * are then renamed over the real one, so a crash never leaves a half-written file.
 * Writes are queued so two requests never write at the same time.
 */
export class JsonFileStorage {
  private queue: Promise<void> = Promise.resolve();

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
    const json = JSON.stringify(data, null, 2);
    const write = async (): Promise<void> => {
      await mkdir(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.tmp`;
      await writeFile(tmp, json, 'utf8');
      await rename(tmp, this.path);
    };
    this.queue = this.queue.then(write, write);
    return this.queue;
  }
}
