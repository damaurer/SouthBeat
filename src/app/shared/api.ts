import { Character } from '../character/character.model';

/** Shapes exchanged between the browser and the server's /api routes. */

export interface StoredFighter extends Character {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** What the creator of a fighter gets back: the fighter and the token that allows editing it. */
export interface OwnedFighter extends StoredFighter {
  editToken: string;
}

/** Header that carries a fighter's edit token on changes. */
export const EDIT_TOKEN_HEADER = 'X-Edit-Token';

export interface FighterStats {
  matches: number;
  wins: number;
  losses: number;
}

export interface MatchRecord {
  id: string;
  winnerId: string;
  loserId: string;
  arenaId: string;
  playedAt: string;
}

export interface NewMatch {
  winnerId: string;
  loserId: string;
  arenaId: string;
}

/** A single-player fight against one of the ladder opponents. */
export interface LadderResult {
  fighterId: string;
  opponentId: string;
  won: boolean;
  playedAt: string;
}

export interface FighterWithStats {
  fighter: StoredFighter;
  stats: FighterStats;
  /** Ladder opponents this fighter has beaten at least once. */
  ladderBeaten: string[];
}

export interface StatsSummary {
  fighters: number;
  matches: number;
  byArena: Record<string, number>;
  leaderboard: { id: string; name: string; wins: number; losses: number }[];
}
