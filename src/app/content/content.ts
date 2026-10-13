import { Arena, ARENAS } from '../arena/arenas';
import { characterErrors } from '../character/balance';
import {
  ACCESSORIES,
  BEARD_STYLES,
  BODY_TYPES,
  Character,
  HAIR_STYLES,
  MOVES,
  MOVE_SLOTS,
  Move,
  MoveSlot,
  OUTFIT_STYLES,
  SHAPE_KEYS,
  SHAPE_MAX,
  SHAPE_MIN,
  STAT_KEYS,
} from '../character/character.model';
import { CpuProfile, DEFAULT_CPU } from '../fight/combat';
import { HIT_LINES } from '../fight/hit-lines';
import { CONTENT_FIGHTERS, RosterEntry } from '../select/roster';
import { OPPONENTS, Opponent } from '../singleplayer/opponents';
import { ArenaSpec, arenaSpecErrors, drawArenaSpec } from './arena-spec';

/**
 * A content pack: new moves, arenas, fighters and ladder opponents as plain JSON.
 * Packs are checked against the same balance rules as everything else in the game, then
 * added to the built-in lists. See AGENTS.md and content/schema/content-pack.schema.json.
 */
export interface ContentPack {
  /** Lowercase letters, digits and dashes, like 'netzwerk-pack'. */
  id: string;
  name: string;
  author?: string;
  version: 1;
  moves?: Move[];
  arenas?: ArenaSpec[];
  /** Extra fighters on the character select screen, bound by the player's point budget. */
  fighters?: FighterSpec[];
  /** Bonus opponents of the single-player ladder, after the final boss. */
  opponents?: OpponentSpec[];
}

export interface FighterSpec {
  id: string;
  title: string;
  character: Character;
  hitLines?: string[];
}

export interface OpponentSpec {
  id: string;
  title: string;
  blurb: string;
  arenaId: string;
  character: Character;
  cpu: CpuProfile;
  lines: string[];
  hitLines: string[];
  chattiness: number;
}

export const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;
/** Content fighters are fair picks: the same budget as the editor. */
export const FIGHTER_BUDGET = 22;
/** Ladder opponents may be stronger, like the built-in bosses. */
export const OPPONENT_BUDGET = 30;

/**
 * Balance of moves, taken from the built-in ones: faster moves hit softer. "Power" is the
 * total damage (damage × hits) minus half the startup frames and must stay in the slot's range.
 */
export const MOVE_RULES: Record<MoveSlot, { startup: [number, number]; power: [number, number]; damage: [number, number] }> = {
  light: { startup: [3, 8], power: [1, 3], damage: [1, 7] },
  heavy: { startup: [6, 20], power: [4, 6], damage: [3, 15] },
  kick: { startup: [6, 16], power: [2.5, 4.5], damage: [3, 12] },
  special: { startup: [6, 30], power: [1, 6.5], damage: [2, 18] },
  ultimate: { startup: [10, 30], power: [19, 21], damage: [4, 36] },
};
/** Thrown specials hit from afar, so they hit softer than close ones. */
export const RANGED_POWER_MAX = 4;
export const MOVE_LIMITS = {
  reach: [16, 200],
  knockback: [0, 40],
  hitstun: [0, 40],
  hits: [1, 5],
  projectileSpeed: [1, 8],
  arc: [0, 40],
  dashSpeed: [1, 6],
} as const;

const HEX = /^#[0-9a-f]{6}$/i;

const text = (v: unknown, min: number, max: number): boolean => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const lines = (v: unknown, max: number): boolean => Array.isArray(v) && v.length <= max && v.every((l) => text(l, 1, 90));

export function movePower(m: Move): number {
  return m.damage * (m.hits ?? 1) - m.startupFrames / 2;
}

export function moveErrors(m: Move, where = 'Move'): string[] {
  const errors: string[] = [];
  if (!m || typeof m !== 'object') return [`${where}: kein Objekt.`];
  if (!MOVE_SLOTS.includes(m.slot)) return [`${where}: slot muss ${MOVE_SLOTS.join(', ')} sein.`];
  if (!text(m.name, 2, 30)) errors.push(`${where}: name muss 2 bis 30 Zeichen haben.`);
  const rule = MOVE_RULES[m.slot];
  const range = (name: string, v: unknown, [lo, hi]: readonly [number, number], whole = true): void => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi || (whole && !Number.isInteger(v))) {
      errors.push(`${where}: ${name} muss ${whole ? 'eine ganze Zahl ' : ''}von ${lo} bis ${hi} sein.`);
    }
  };
  range('damage', m.damage, rule.damage);
  range('startupFrames', m.startupFrames, rule.startup);
  for (const key of Object.keys(MOVE_LIMITS) as (keyof typeof MOVE_LIMITS)[]) {
    if (m[key] !== undefined) range(key, m[key], MOVE_LIMITS[key], key !== 'projectileSpeed');
  }
  if (m.slot !== 'special' && (m.projectileSpeed || m.arc || m.dashSpeed)) {
    errors.push(`${where}: Geschosse, Bogenwürfe und Sturmangriffe gibt es nur als special.`);
  }
  if (m.arc && !m.projectileSpeed) errors.push(`${where}: arc braucht projectileSpeed.`);
  if (m.shots !== undefined) errors.push(`${where}: shots gibt es nur für Stage-Gegner.`);
  if (errors.length === 0) {
    const power = movePower(m);
    const [lo, hi] = rule.power;
    if (power < lo || power > hi) {
      errors.push(
        `${where}: unausgewogen. damage × hits − startupFrames/2 ergibt ${power}, erlaubt sind ${lo} bis ${hi} für ${m.slot}. Schnellere Moves müssen schwächer sein.`,
      );
    } else if (m.slot === 'special' && m.projectileSpeed && power > RANGED_POWER_MAX) {
      errors.push(`${where}: Geschosse treffen aus der Ferne, daher höchstens ${RANGED_POWER_MAX} statt ${power} (damage × hits − startupFrames/2).`);
    }
  }
  if (m.look !== undefined) {
    const ok =
      typeof m.look === 'object' &&
      (m.look.colors === undefined || (Array.isArray(m.look.colors) && m.look.colors.length === 2 && m.look.colors.every((c) => HEX.test(c)))) &&
      (m.look.label === undefined || /^[A-Za-z0-9 !?.\-:/]{1,10}$/.test(m.look.label));
    if (!ok) errors.push(`${where}: look braucht colors als zwei Farben (#rrggbb) und optional label mit bis zu 10 Zeichen A–Z.`);
  }
  return errors;
}

function cpuErrors(cpu: CpuProfile, where: string): string[] {
  const ok =
    cpu &&
    typeof cpu === 'object' &&
    [cpu.aggression, cpu.specialChance].every((v) => typeof v === 'number' && v >= 0 && v <= 0.2) &&
    [cpu.blockChance, cpu.jumpChance].every((v) => v === undefined || (typeof v === 'number' && v >= 0 && v <= 0.6)) &&
    (cpu.skill === undefined || (typeof cpu.skill === 'number' && cpu.skill >= 0 && cpu.skill <= 1));
  return ok ? [] : [`${where}: cpu braucht aggression und specialChance von 0 bis 0.2, blockChance und jumpChance von 0 bis 0.6, skill von 0 bis 1.`];
}

/** The ids content may not reuse: built-ins and other installed packs. */
export interface TakenIds {
  moves: Set<string>;
  arenas: Set<string>;
  fighters: Set<string>;
}

/** Ids in use right now, except those of the given pack (so a pack can be replaced). */
export function takenIds(exceptPack?: string): TakenIds {
  const own = exceptPack ? installedPacks.find((p) => p.id === exceptPack) : undefined;
  const mine = new Set([...(own?.moves ?? []), ...(own?.arenas ?? []), ...(own?.fighters ?? []), ...(own?.opponents ?? [])].map((x) => x.id));
  const keep = (ids: string[]): Set<string> => new Set(ids.filter((id) => !mine.has(id)));
  return {
    moves: keep(MOVES.map((m) => m.id)),
    arenas: keep(ARENAS.map((a) => a.id)),
    fighters: keep(['me', 'random', 'sparring', ...OPPONENTS.map((o) => o.id), ...CONTENT_FIGHTERS.map((f) => f.id)]),
  };
}

/**
 * Everything wrong with a pack, in words an author (or an LLM) can act on. Empty means it
 * can be installed.
 */
export function packErrors(pack: ContentPack, taken: TakenIds = takenIds(pack?.id)): string[] {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return ['Das Paket muss ein JSON-Objekt sein.'];
  const errors: string[] = [];
  if (typeof pack.id !== 'string' || !ID_PATTERN.test(pack.id)) errors.push('id des Pakets: 2 bis 40 Zeichen, nur a–z, 0–9 und -.');
  if (!text(pack.name, 2, 40)) errors.push('name des Pakets muss 2 bis 40 Zeichen haben.');
  if (pack.version !== 1) errors.push('version muss 1 sein.');
  if (pack.author !== undefined && !text(pack.author, 1, 40)) errors.push('author darf höchstens 40 Zeichen haben.');
  const known = new Set(['id', 'name', 'author', 'version', 'moves', 'arenas', 'fighters', 'opponents', '$schema']);
  for (const key of Object.keys(pack)) if (!known.has(key)) errors.push(`Unbekanntes Feld "${key}" im Paket.`);
  const lists = ['moves', 'arenas', 'fighters', 'opponents'] as const;
  for (const key of lists) {
    if (pack[key] !== undefined && (!Array.isArray(pack[key]) || pack[key]!.length > 30)) errors.push(`${key} muss eine Liste mit höchstens 30 Einträgen sein.`);
  }
  if (errors.length > 0) return errors;
  if (lists.every((k) => !pack[k]?.length)) errors.push('Das Paket ist leer: es braucht mindestens einen Move, eine Arena, einen Kämpfer oder einen Gegner.');

  const seen = new Set<string>();
  const checkId = (id: unknown, where: string, used: Set<string>): void => {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) errors.push(`${where}: id muss 2 bis 40 Zeichen a–z, 0–9 oder - haben.`);
    else if (used.has(id) || seen.has(id)) errors.push(`${where}: die id "${id}" gibt es schon.`);
    seen.add(String(id));
  };

  const packMoves = new Map<string, Move>();
  (pack.moves ?? []).forEach((m, i) => {
    const where = `moves[${i}]${m?.id ? ` (${m.id})` : ''}`;
    checkId(m?.id, where, taken.moves);
    errors.push(...moveErrors(m, where));
    if (m?.id) packMoves.set(m.id, m);
  });
  const packArenas = new Set<string>();
  (pack.arenas ?? []).forEach((a, i) => {
    const where = `arenas[${i}]${a?.id ? ` (${a.id})` : ''}`;
    checkId(a?.id, where, taken.arenas);
    if (!text(a?.name, 2, 30)) errors.push(`${where}: name muss 2 bis 30 Zeichen haben.`);
    if (!text(a?.description, 2, 200)) errors.push(`${where}: description muss 2 bis 200 Zeichen haben.`);
    errors.push(...arenaSpecErrors(a, where));
    packArenas.add(a?.id);
  });

  // A pack's own signature moves can only be used by its own fighters and opponents.
  const allowExclusive = (id: string): boolean => packMoves.has(id);
  const knownMove = (id: string): Move | undefined => packMoves.get(id) ?? MOVES.find((m) => m.id === id);
  const checkCharacter = (c: Character, where: string, budget: number): void => {
    if (!c || typeof c !== 'object') return void errors.push(`${where}: character fehlt.`);
    const withPackMoves = MOVE_SLOTS.every((s) => knownMove(c.moves?.[s]));
    if (!withPackMoves) {
      const missing = MOVE_SLOTS.filter((s) => !knownMove(c.moves?.[s])).map((s) => `${s}="${c.moves?.[s]}"`);
      errors.push(`${where}: unbekannte Moves ${missing.join(', ')}.`);
      return;
    }
    // Pack moves are checked as if installed: temporarily known for the character check.
    const added = [...packMoves.values()].filter((m) => !MOVES.includes(m));
    MOVES.push(...added);
    try {
      errors.push(...characterErrors({ ...c, name: String(c.name ?? '') }, { budget, allowExclusive }).map((e) => `${where}: ${e}`));
    } finally {
      for (const m of added) MOVES.splice(MOVES.indexOf(m), 1);
    }
  };

  (pack.fighters ?? []).forEach((f, i) => {
    const where = `fighters[${i}]${f?.id ? ` (${f.id})` : ''}`;
    checkId(f?.id, where, taken.fighters);
    if (!text(f?.title, 2, 40)) errors.push(`${where}: title muss 2 bis 40 Zeichen haben.`);
    if (f?.hitLines !== undefined && !lines(f.hitLines, 20)) errors.push(`${where}: hitLines: höchstens 20 Sätze mit bis zu 90 Zeichen.`);
    checkCharacter(f?.character, where, FIGHTER_BUDGET);
  });
  (pack.opponents ?? []).forEach((o, i) => {
    const where = `opponents[${i}]${o?.id ? ` (${o.id})` : ''}`;
    checkId(o?.id, where, taken.fighters);
    if (!text(o?.title, 2, 40)) errors.push(`${where}: title muss 2 bis 40 Zeichen haben.`);
    if (!text(o?.blurb, 2, 200)) errors.push(`${where}: blurb muss 2 bis 200 Zeichen haben.`);
    if (!(taken.arenas.has(o?.arenaId) || packArenas.has(o?.arenaId))) errors.push(`${where}: unbekannte arenaId "${o?.arenaId}".`);
    if (!lines(o?.lines, 30) || o.lines.length < 1) errors.push(`${where}: lines: 1 bis 30 Sätze mit bis zu 90 Zeichen.`);
    if (!lines(o?.hitLines, 20) || o.hitLines.length < 1) errors.push(`${where}: hitLines: 1 bis 20 Sätze mit bis zu 90 Zeichen.`);
    if (typeof o?.chattiness !== 'number' || o.chattiness < 2 || o.chattiness > 30) errors.push(`${where}: chattiness (Sekunden zwischen Sprüchen) muss 2 bis 30 sein.`);
    errors.push(...cpuErrors(o?.cpu, where));
    checkCharacter(o?.character, where, OPPONENT_BUDGET);
  });
  return errors;
}

/** Only the known fields, so nothing unexpected reaches the game or the data file. */
export function cleanPack(pack: ContentPack): ContentPack {
  const json = JSON.parse(JSON.stringify(pack)) as ContentPack;
  delete (json as { $schema?: string }).$schema;
  return json;
}

let installedPacks: ContentPack[] = [];
/** Entries that came from packs, so they can be taken out again. */
const installed = new WeakSet<object>();

function arenaOf(spec: ArenaSpec): Arena {
  return { id: spec.id, name: spec.name, description: spec.description, draw: (p) => drawArenaSpec(spec, p) };
}

/** Takes all pack content out of the game again. */
export function clearContent(): void {
  installedPacks = [];
  for (const list of [MOVES, ARENAS, OPPONENTS, CONTENT_FIGHTERS] as object[][]) {
    for (let i = list.length - 1; i >= 0; i--) if (installed.has(list[i])) list.splice(i, 1);
  }
}

/**
 * Makes exactly these packs part of the game, replacing whatever was installed before.
 * Packs that do not pass the checks are skipped and returned with their errors.
 */
export function installPacks(packs: readonly ContentPack[]): { pack: string; errors: string[] }[] {
  clearContent();
  const rejected: { pack: string; errors: string[] }[] = [];
  for (const pack of packs) {
    // One by one, so the next pack sees this one's ids as taken.
    const errors = packErrors(pack, takenIds());
    if (errors.length > 0) rejected.push({ pack: String(pack?.id), errors });
    else add(pack);
  }
  return rejected;
}

function add(pack: ContentPack): void {
  installedPacks = [...installedPacks, pack];
  const push = <T extends object>(list: T[], items: T[]): void => {
    for (const item of items) {
      installed.add(item);
      list.push(item);
    }
  };
  push(MOVES, (pack.moves ?? []).map((m) => ({ ...m })));
  push(ARENAS, (pack.arenas ?? []).map(arenaOf));
  push(OPPONENTS, (pack.opponents ?? []).map((o): Opponent => ({ ...o, cpu: { ...DEFAULT_CPU, ...o.cpu } })));
  push(
    CONTENT_FIGHTERS,
    (pack.fighters ?? []).map(
      (f): RosterEntry => ({ id: f.id, name: f.character.name, title: f.title, character: f.character, hitLines: f.hitLines?.length ? f.hitLines : HIT_LINES, cpu: DEFAULT_CPU, locked: false }),
    ),
  );
}

export function installedContent(): readonly ContentPack[] {
  return installedPacks;
}

/** Short facts about the game for an author or an LLM: what exists and which values are allowed. */
export function contentReference(): string {
  const bySlot = MOVE_SLOTS.map((slot) => {
    const list = MOVES.filter((m) => m.slot === slot && !m.exclusive).map((m) => `${m.id} (${m.name}, damage ${m.damage}${m.hits ? `×${m.hits}` : ''}, startup ${m.startupFrames})`);
    return `- ${slot}: ${list.join('; ')}`;
  });
  const r = MOVE_RULES;
  return [
    'SouthBeat ist ein 2D-Pixel-Prügelspiel im Büro: alle Kämpfer sind Programmierer, Attacken kommen vom Schreibtisch.',
    '',
    'Moves, die Spieler frei wählen können:',
    ...bySlot,
    '',
    `Exklusive Moves der Bosse (nicht nutzbar): ${MOVES.filter((m) => m.exclusive).map((m) => m.id).join(', ')}`,
    `Arenen: ${ARENAS.map((a) => `${a.id} (${a.name})`).join(', ')}`,
    `Kämpfer-IDs, die schon vergeben sind: ${[...takenIds().fighters].join(', ')}`,
    '',
    'Regeln für Moves (power = damage × hits − startupFrames/2):',
    ...MOVE_SLOTS.map((s) => `- ${s}: startupFrames ${r[s].startup.join('–')}, damage ${r[s].damage.join('–')}, power ${r[s].power.join('–')}`),
    `- Geschosse (special mit projectileSpeed): power höchstens ${RANGED_POWER_MAX}.`,
    `- Optional: reach ${MOVE_LIMITS.reach.join('–')}, knockback ${MOVE_LIMITS.knockback.join('–')}, hitstun ${MOVE_LIMITS.hitstun.join('–')}, hits ${MOVE_LIMITS.hits.join('–')}; nur special: projectileSpeed ${MOVE_LIMITS.projectileSpeed.join('–')}, arc ${MOVE_LIMITS.arc.join('–')} (Bogenwurf, braucht projectileSpeed), dashSpeed ${MOVE_LIMITS.dashSpeed.join('–')} (Sturmangriff).`,
    '- exclusive: true macht einen Move zur Signatur-Attacke, die nur Kämpfer und Gegner aus demselben Paket nutzen.',
    '- look: { colors: [zwei Farben], label: "WORT" } bestimmt, wie ein Ultimate aussieht.',
    '',
    `Charaktere: stats ${STAT_KEYS.join(', ')} je 1–10; Summe höchstens ${FIGHTER_BUDGET} für fighters, ${OPPONENT_BUDGET} für opponents. Name 2–16 Zeichen.`,
    `Aussehen: bodyType ${BODY_TYPES.join('|')}; accessory ${ACCESSORIES.join('|')}; hairStyle ${HAIR_STYLES.join('|')}; beardStyle ${BEARD_STYLES.join('|')}; outfitStyle ${OUTFIT_STYLES.join('|')}; skinColor, eyeColor, hairColor, outfitColor als #rrggbb; optional shape mit ${SHAPE_KEYS.join(', ')} als ganze Zahlen ${SHAPE_MIN}..${SHAPE_MAX}.`,
    'fighters erscheinen in der Kämpferauswahl. opponents sind Bonus-Gegner der Einzelspieler-Leiter nach dem Endboss und brauchen title, blurb, arenaId, cpu, lines, hitLines, chattiness.',
    'Arenen sind 240×135 Pixel groß, die Wand endet bei y=100. Props werden der Reihe nach gemalt.',
  ].join('\n');
}
