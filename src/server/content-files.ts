import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ContentPack, ID_PATTERN } from '../app/content/content';

/**
 * Content packs on disk: one JSON file per pack. Packs that ship with the game live in
 * content/packs (added by hand or by coding agents), packs made in the content studio in
 * the data folder next to the fighters, so they survive container updates.
 */
export class ContentFiles {
  constructor(
    /** Read only: packs in the repository. */
    readonly shippedDir: string,
    /** Read and write: packs from the studio. */
    readonly studioDir: string,
  ) {}

  /** All packs, shipped ones first; files that are not valid JSON are reported and skipped. */
  async load(): Promise<{ packs: { pack: ContentPack; file: string; studio: boolean }[]; broken: string[] }> {
    const packs: { pack: ContentPack; file: string; studio: boolean }[] = [];
    const broken: string[] = [];
    for (const [dir, studio] of [[this.shippedDir, false], [this.studioDir, true]] as const) {
      for (const name of (await listJson(dir)).sort()) {
        const file = join(dir, name);
        try {
          packs.push({ pack: JSON.parse(await readFile(file, 'utf8')), file, studio });
        } catch (error) {
          broken.push(`${file}: ${(error as Error).message}`);
        }
      }
    }
    return { packs, broken };
  }

  async saveStudioPack(pack: ContentPack): Promise<string> {
    if (!ID_PATTERN.test(pack.id)) throw new Error('Ungültige Paket-id');
    await mkdir(this.studioDir, { recursive: true });
    const file = join(this.studioDir, `${pack.id}.json`);
    await writeFile(`${file}.tmp`, JSON.stringify(pack, null, 2) + '\n', 'utf8');
    await rename(`${file}.tmp`, file);
    return file;
  }

  async deleteStudioPack(id: string): Promise<void> {
    if (!ID_PATTERN.test(id)) return;
    await unlink(join(this.studioDir, `${id}.json`)).catch(() => undefined);
  }
}

async function listJson(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }
}
