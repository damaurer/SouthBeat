import { Character } from '../character/character.model';

/** Shapes exchanged between the browser and the server's /api routes. */

export interface StoredFighter extends Character {
  id: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface FighterWithStats {
  fighter: StoredFighter;
  stats: FighterStats;
}

export interface StatsSummary {
  fighters: number;
  matches: number;
  byArena: Record<string, number>;
  leaderboard: { id: string; name: string; wins: number; losses: number }[];
}
