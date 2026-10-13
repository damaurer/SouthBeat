import { characterErrors } from '../app/character/balance';
import { Character, MOVE_SLOTS, STAT_KEYS } from '../app/character/character.model';
import { findArena } from '../app/arena/arenas';
import { FighterStats, FighterWithStats, MatchRecord, NewMatch, StatsSummary, StoredFighter } from '../app/shared/api';

/** Everything the game persists. This object is written to the data file as JSON. */
export interface GameData {
  version: 1;
  fighters: StoredFighter[];
  matches: MatchRecord[];
}

export function emptyGameData(): GameData {
  return { version: 1, fighters: [], matches: [] };
}

export class GameDataError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Rules for reading and changing the game data. It holds no I/O so it can be
 * tested anywhere; the server wraps it with the file storage.
 */
export class GameDataRules {
  constructor(
    private readonly data: GameData,
    private readonly newId: () => string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  snapshot(): GameData {
    return this.data;
  }

  listFighters(): StoredFighter[] {
    return this.data.fighters;
  }

  getFighter(id: string): FighterWithStats {
    const fighter = this.find(id);
    return { fighter, stats: this.statsFor(id) };
  }

  createFighter(input: unknown): StoredFighter {
    const character = this.clean(input);
    const at = this.now().toISOString();
    const fighter: StoredFighter = { ...character, id: this.newId(), createdAt: at, updatedAt: at };
    this.data.fighters.push(fighter);
    return fighter;
  }

  updateFighter(id: string, input: unknown): StoredFighter {
    const existing = this.find(id);
    const character = this.clean(input);
    Object.assign(existing, character, { updatedAt: this.now().toISOString() });
    return existing;
  }

  recordMatch(input: Partial<NewMatch>): MatchRecord {
    const { winnerId, loserId, arenaId } = input ?? {};
    if (typeof winnerId !== 'string' || typeof loserId !== 'string' || typeof arenaId !== 'string') {
      throw new GameDataError(400, 'winnerId, loserId und arenaId sind Pflicht.');
    }
    if (winnerId === loserId) throw new GameDataError(400, 'Ein Kämpfer kann nicht gegen sich selbst gewinnen.');
    this.find(winnerId);
    this.find(loserId);
    if (findArena(arenaId).id !== arenaId) throw new GameDataError(400, 'Unbekannte Arena.');
    const match: MatchRecord = { id: this.newId(), winnerId, loserId, arenaId, playedAt: this.now().toISOString() };
    this.data.matches.push(match);
    return match;
  }

  statsFor(id: string): FighterStats {
    let wins = 0;
    let losses = 0;
    for (const m of this.data.matches) {
      if (m.winnerId === id) wins++;
      if (m.loserId === id) losses++;
    }
    return { matches: wins + losses, wins, losses };
  }

  summary(): StatsSummary {
    const byArena: Record<string, number> = {};
    for (const m of this.data.matches) byArena[m.arenaId] = (byArena[m.arenaId] ?? 0) + 1;
    const leaderboard = this.data.fighters
      .map((f) => ({ id: f.id, name: f.name, ...this.statsFor(f.id) }))
      .filter((f) => f.matches > 0)
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
      .slice(0, 10)
      .map(({ id, name, wins, losses }) => ({ id, name, wins, losses }));
    return { fighters: this.data.fighters.length, matches: this.data.matches.length, byArena, leaderboard };
  }

  private find(id: string): StoredFighter {
    const fighter = this.data.fighters.find((f) => f.id === id);
    if (!fighter) throw new GameDataError(404, 'Kämpfer nicht gefunden.');
    return fighter;
  }

  /** Copies only known fields, so a client cannot smuggle extra data into the file. */
  private clean(input: unknown): Character {
    const raw = (input ?? {}) as Partial<Character>;
    const look = (raw.appearance ?? {}) as Partial<Character['appearance']>;
    const character = {
      name: typeof raw.name === 'string' ? raw.name.trim() : '',
      appearance: {
        skinColor: look.skinColor,
        eyeColor: look.eyeColor,
        hairColor: look.hairColor,
        hairStyle: look.hairStyle,
        beardStyle: look.beardStyle,
        outfitColor: look.outfitColor,
        outfitStyle: look.outfitStyle,
      },
      moves: Object.fromEntries(MOVE_SLOTS.map((s) => [s, raw.moves?.[s]])),
      stats: Object.fromEntries(STAT_KEYS.map((k) => [k, raw.stats?.[k]])),
    } as Character;
    const errors = characterErrors(character);
    if (errors.length > 0) throw new GameDataError(400, errors.join(' '));
    return character;
  }
}
