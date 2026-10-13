// Command line for content packs; run it with `npm run content -- <command>`.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { ContentPack, contentReference, installPacks, installedContent, packErrors, takenIds } from '../src/app/content/content';
import { contentPackSchema } from '../src/app/content/content-schema';
import { ContentFiles } from '../src/server/content-files';

const SHIPPED = join('content', 'packs');
const STUDIO = join('data', 'content');
const SCHEMA = join('content', 'schema', 'content-pack.schema.json');

const HELP = `SouthBeat-Inhaltspakete

  npm run content -- validate <datei.json>...   Pakete prüfen (gegen Spiel und content/packs)
  npm run content -- add <datei.json>           prüfen und nach content/packs kopieren
  npm run content -- list                       installierte Pakete anzeigen
  npm run content -- reference                  Spielwerte und Regeln für Autoren und LLMs
  npm run content -- schema                     content/schema/content-pack.schema.json neu schreiben`;

async function installed(): Promise<void> {
  const { packs, broken } = await new ContentFiles(SHIPPED, STUDIO).load();
  for (const b of broken) console.error(`Kaputte Datei: ${b}`);
  for (const r of installPacks(packs.map((p) => p.pack))) console.error(`Paket ${r.pack} wird übersprungen:\n  ${r.errors.join('\n  ')}`);
}

async function check(file: string): Promise<ContentPack | null> {
  let pack: ContentPack;
  try {
    pack = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    console.error(`✗ ${file}: kein gültiges JSON (${(error as Error).message})`);
    return null;
  }
  const errors = packErrors(pack, takenIds(pack?.id));
  if (errors.length > 0) {
    console.error(`✗ ${file}:\n  ${errors.join('\n  ')}`);
    return null;
  }
  const count = (['moves', 'arenas', 'fighters', 'opponents'] as const).map((k) => `${pack[k]?.length ?? 0} ${k}`).join(', ');
  console.log(`✓ ${file}: Paket "${pack.id}" ist in Ordnung (${count}).`);
  return pack;
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case 'validate': {
    await installed();
    let ok = args.length > 0;
    for (const file of args) ok = (await check(file)) !== null && ok;
    process.exit(ok ? 0 : 1);
    break;
  }
  case 'add': {
    await installed();
    const pack = args[0] ? await check(args[0]) : null;
    if (!pack) process.exit(1);
    await mkdir(SHIPPED, { recursive: true });
    const target = join(SHIPPED, `${pack.id}.json`);
    if (basename(args[0]) !== `${pack.id}.json` || !args[0].startsWith(SHIPPED)) await copyFile(args[0], target);
    console.log(`→ ${target}. Neu starten (oder neu bauen), dann ist der Inhalt im Spiel.`);
    break;
  }
  case 'list': {
    await installed();
    for (const p of installedContent()) console.log(`${p.id}: ${p.name} (${['moves', 'arenas', 'fighters', 'opponents'].map((k) => `${(p as unknown as Record<string, unknown[]>)[k]?.length ?? 0} ${k}`).join(', ')})`);
    if (installedContent().length === 0) console.log('Keine Pakete installiert.');
    break;
  }
  case 'reference':
    await installed();
    console.log(contentReference());
    break;
  case 'schema':
    await mkdir(join('content', 'schema'), { recursive: true });
    await writeFile(SCHEMA, JSON.stringify(contentPackSchema(), null, 2) + '\n', 'utf8');
    console.log(`→ ${SCHEMA}`);
    break;
  default:
    console.log(HELP);
    process.exit(command ? 1 : 0);
}
