import { characterErrors } from '../app/character/balance';
import { Character, MOVE_SLOTS, STAT_KEYS } from '../app/character/character.model';
import { findArena } from '../app/arena/arenas';
import { FighterStats, FighterWithStats, LadderResult, MatchRecord, NewMatch, OwnedFighter, StatsSummary, StoredFighter } from '../app/shared/api';
import { OPPONENTS, findOpponent } from '../app/singleplayer/opponents';

/**
 * A fighter as kept in the data file. Only the hash of its edit token is stored; the token
 * itself lives in the creator's browser. Fighters saved before tokens existed have none.
 */
export interface ServerFighter extends StoredFighter {
  tokenHash?: string;
}

/** More fighters than this and the server refuses new ones, so the file cannot be flooded. */
export const MAX_FIGHTERS = 5000;

/** Everything the game persists. This object is written to the data file as JSON. */
export interface GameData {
  version: 1;
  fighters: ServerFighter[];
  matches: MatchRecord[];
  /** Added later; files written before it existed don't have it. */
  ladder?: LadderResult[];
}

export function emptyGameData(): GameData {
  return { version: 1, fighters: [], matches: [], ladder: [] };
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
    /** Turns an edit token into what is stored; the server passes SHA-256. */
    private readonly hash: (token: string) => string = (t) => t,
  ) {}

  snapshot(): GameData {
    return this.data;
  }

  listFighters(): StoredFighter[] {
    return this.data.fighters.map(publicFighter);
  }

  getFighter(id: string): FighterWithStats {
    const fighter = publicFighter(this.find(id));
    return { fighter, stats: this.statsFor(id), ladderBeaten: this.ladderBeaten(id) };
  }

  /** A ladder fight of the fighter's owner; an opponent counts only once everyone before them is beaten. */
  recordLadder(fighterId: string, input: { opponentId?: unknown; won?: unknown }, token: unknown): LadderResult {
    this.authorize(fighterId, token, false);
    const { opponentId, won } = input ?? {};
    if (typeof opponentId !== 'string' || !findOpponent(opponentId)) throw new GameDataError(400, 'Unbekannter Gegner.');
    if (typeof won !== 'boolean') throw new GameDataError(400, 'won muss true oder false sein.');
    const beaten = this.ladderBeaten(fighterId);
    const before = OPPONENTS.slice(0, OPPONENTS.findIndex((o) => o.id === opponentId));
    if (!before.every((o) => beaten.includes(o.id))) throw new GameDataError(403, 'Dieser Gegner ist noch nicht freigeschaltet.');
    const result: LadderResult = { fighterId, opponentId, won, playedAt: this.now().toISOString() };
    (this.data.ladder ??= []).push(result);
    return result;
  }

  ladderBeaten(fighterId: string): string[] {
    const beaten = new Set((this.data.ladder ?? []).filter((r) => r.fighterId === fighterId && r.won).map((r) => r.opponentId));
    return [...beaten];
  }

  /** A new fighter and its edit token; the token is only ever shown here. */
  createFighter(input: unknown): OwnedFighter {
    const character = cleanCharacter(input);
    if (this.data.fighters.length >= MAX_FIGHTERS) throw new GameDataError(503, 'Der Server hat keinen Platz für weitere Kämpfer.');
    const at = this.now().toISOString();
    const id = this.newId();
    const editToken = this.newToken();
    const fighter: ServerFighter = { ...character, id, createdAt: at, updatedAt: at, tokenHash: this.hash(editToken) };
    this.data.fighters.push(fighter);
    return { ...publicFighter(fighter), editToken };
  }

  /** Only with the fighter's edit token. A fighter from before tokens gets one now, for whoever saves it first. */
  updateFighter(id: string, input: unknown, token: unknown): StoredFighter | OwnedFighter {
    const claimed = this.authorize(id, token);
    const existing = this.find(id);
    const character = cleanCharacter(input);
    Object.assign(existing, character, { updatedAt: this.now().toISOString() });
    return claimed ? { ...publicFighter(existing), editToken: claimed } : publicFighter(existing);
  }

  /** True if the token belongs to the fighter. Online results only count for proven owners. */
  owns(id: unknown, token: unknown): boolean {
    const fighter = typeof id === 'string' ? this.data.fighters.find((f) => f.id === id) : undefined;
    return !!fighter?.tokenHash && typeof token === 'string' && this.hash(token) === fighter.tokenHash;
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

  /**
   * Throws unless the token fits. A fighter without a token (saved by an older version) is
   * claimed when it is saved: it gets a new token, which is returned so the caller can hand it out.
   */
  private authorize(id: string, token: unknown, claim = true): string | null {
    const fighter = this.find(id);
    if (!fighter.tokenHash && claim) {
      const fresh = this.newToken();
      fighter.tokenHash = this.hash(fresh);
      return fresh;
    }
    if (!this.owns(id, token)) throw new GameDataError(403, 'Dieser Kämpfer gehört jemand anderem.');
    return null;
  }

  private newToken(): string {
    return `${this.newId()}${this.newId()}`.replace(/-/g, '');
  }

  private find(id: string): ServerFighter {
    const fighter = this.data.fighters.find((f) => f.id === id);
    if (!fighter) throw new GameDataError(404, 'Kämpfer nicht gefunden.');
    return fighter;
  }
}

/** A fighter without anything secret, as everyone may see it. */
function publicFighter({ tokenHash: _, ...fighter }: ServerFighter): StoredFighter {
  return fighter;
}

/** Copies only known fields, so a client cannot smuggle extra data into the file. */
export function cleanCharacter(input: unknown): Character {
  const raw = (input ?? {}) as Partial<Character>;
  const look = (raw.appearance ?? {}) as Partial<Character['appearance']>;
  const character = {
    name: typeof raw.name === 'string' ? raw.name.trim() : '',
    appearance: {
      bodyType: look.bodyType,
      accessory: look.accessory,
      skinColor: look.skinColor,
      eyeColor: look.eyeColor,
      hairColor: look.hairColor,
      hairStyle: look.hairStyle,
      beardStyle: look.beardStyle,
      outfitColor: look.outfitColor,
      outfitStyle: look.outfitStyle,
      ...(look.shape !== undefined ? { shape: look.shape } : {}),
    },
    moves: Object.fromEntries(MOVE_SLOTS.map((s) => [s, raw.moves?.[s]])),
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, raw.stats?.[k]])),
    ...(raw.projectileArt !== undefined ? { projectileArt: raw.projectileArt } : {}),
  } as Character;
  const errors = characterErrors(character);
  if (errors.length > 0) throw new GameDataError(400, errors.join(' '));
  return character;
}
