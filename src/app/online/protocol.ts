import { Character, MOVES, MoveSlot, findMove } from '../character/character.model';
import { BEST_OF_THREE, Controls, FightEvent, FightState, FighterState, NO_INPUT, step } from '../fight/combat';
import { Brawler, Projectile, StageState } from '../stage/brawl';
import { Campaign } from '../stage/campaign';
import { STAGES } from '../stage/stages';

/** WebSocket path of the online fight server. */
export const ONLINE_PATH = '/online';
/** How long a started game waits for a player whose connection dropped. */
export const RECONNECT_MS = 15_000;

/** A fighter as sent every frame; the character itself is sent once at the start. */
export type FighterSnapshot = Omit<FighterState, 'character'>;

export interface FightSnapshot {
  frame: number;
  winner: FightState['winner'];
  round: number;
  wins: [number, number];
  intro: number;
  roundWinner: FightState['roundWinner'];
  ko: number;
  events: FightEvent[];
  fighters: [FighterSnapshot, FighterSnapshot];
}

/** What a lobby plays: a one-on-one fight, or the co-op stage mode. */
export type GameMode = 'duel' | 'stage';

export const GAME_MODES: Record<GameMode, string> = {
  duel: 'Zweikampf',
  stage: 'Stage-Modus (Koop)',
};

export type ClientMessage =
  | { type: 'create'; name: string; mode: GameMode; rosterId: string; fighter: Character; fighterId: string | null; editToken: string | null; arenaId: string }
  | { type: 'join'; code: string; rosterId: string; fighter: Character; fighterId: string | null; editToken: string | null }
  /** Sent whenever a key changes: which way the player walks, and an attack button if one was just pressed. */
  | { type: 'input'; left: boolean; right: boolean; up: boolean; down: boolean; press: MoveSlot | null }
  /** After a fight: rematch. In the stage mode: try the stage again, or start over after the last one. */
  | { type: 'rematch' }
  /** After a dropped connection: take the old seat again with the secret from 'room' or 'start'. */
  | { type: 'resume'; code: string; token: string }
  /** Leaves the game on purpose, so the other player does not wait for a comeback. */
  | { type: 'leave' }
  /** Measures the round trip; the server answers with the same number. */
  | { type: 'ping'; t: number };

/** An open lobby waiting for a second player, as shown in the lobby table. */
export interface LobbyInfo {
  code: string;
  name: string;
  host: string;
  mode: GameMode;
  arenaId: string;
}

export const LOBBY_NAME_MAX = 30;

export type ServerMessage =
  | { type: 'lobbies'; lobbies: LobbyInfo[] }
  | { type: 'room'; code: string; name: string; mode: GameMode; arenaId: string; resume: string }
  | { type: 'start'; mode: GameMode; you: 0 | 1; arenaId: string; characters: [Character, Character]; rosterIds: [string, string]; fighterIds: [string | null, string | null]; code: string; resume: string }
  | { type: 'state'; snapshot: FightSnapshot }
  | { type: 'stage'; snapshot: StageSnapshot }
  | { type: 'rematch-wanted'; by: 0 | 1 }
  | { type: 'opponent-left' }
  /** The other player's connection dropped; the game is paused for up to this many seconds. */
  | { type: 'opponent-away'; seconds: number }
  | { type: 'opponent-back' }
  | { type: 'pong'; t: number }
  | { type: 'error'; message: string };

export function snapshotOf(state: FightState): FightSnapshot {
  const strip = ({ character: _, ...rest }: FighterState): FighterSnapshot => rest;
  return {
    frame: state.frame,
    winner: state.winner,
    round: state.round,
    wins: state.wins,
    intro: state.intro,
    roundWinner: state.roundWinner,
    ko: state.ko,
    events: state.events,
    fighters: [strip(state.fighters[0]), strip(state.fighters[1])],
  };
}

/** Rebuilds a full fight state on the client from a snapshot and the two characters. */
export function stateFrom(snapshot: FightSnapshot, characters: [Character, Character], arenaId: string): FightState {
  return {
    arenaId,
    frame: snapshot.frame,
    winner: snapshot.winner,
    rules: BEST_OF_THREE,
    round: snapshot.round,
    wins: snapshot.wins,
    intro: snapshot.intro,
    roundWinner: snapshot.roundWinner,
    ko: snapshot.ko,
    events: snapshot.events,
    hitstop: 0,
    fighters: [
      { ...snapshot.fighters[0], character: characters[0] },
      { ...snapshot.fighters[1], character: characters[1] },
    ],
  };
}

/** The most frames the client runs ahead of the server; beyond that guesses get too wild. */
export const MAX_PREDICTION = 10;

/**
 * Client-side prediction for the duel: the server's state is a round trip old for your own
 * presses, so the client replays the presses the server has not seen yet on a copy. You see
 * your own fighter react at once; the opponent is shown standing still for those frames, and
 * the next server frame corrects any wrong guess. Events of the guessed frames are dropped.
 */
export function predict(state: FightState, you: 0 | 1, inputs: readonly Controls[]): FightState {
  const ahead = inputs.slice(-MAX_PREDICTION);
  if (ahead.length === 0 || state.winner !== null) return state;
  const copy = cloneState(state);
  for (const c of ahead) step(copy, you === 0 ? [c, NO_INPUT] : [NO_INPUT, c]);
  copy.events = [];
  return copy;
}

/** A deep copy of the fight; characters and moves are shared, they never change in a fight. */
function cloneState(state: FightState): FightState {
  const copy = (value: unknown, key = ''): unknown => {
    if (value === null || typeof value !== 'object' || key === 'character' || key === 'move' || key === 'rules') return value;
    if (Array.isArray(value)) return value.map((v) => copy(v));
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copy(v, k)]));
  };
  return copy(state) as FightState;
}

/**
 * What goes over the wire, many times per second: moves travel as their id (both sides know
 * every move, content packs included), and fractions are rounded to two places.
 */
export function encodeMessage(msg: ServerMessage): string {
  return JSON.stringify(msg, (key, value) => {
    if (typeof value === 'number' && !Number.isInteger(value)) return Math.round(value * 100) / 100;
    if (key === 'move' && value && typeof value === 'object' && typeof value.id === 'string') return value.id;
    return value;
  });
}

export function decodeMessage(text: string): ServerMessage {
  return JSON.parse(text, (key, value) => (key === 'move' && typeof value === 'string' ? (findMove(value) ?? MOVES[0]) : value));
}

/** Room codes avoid letters that are easy to mix up, like O and 0 or I and 1. */
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function newRoomCode(random: () => number): string {
  return Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)]).join('');
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/** A stage frame as sent online. Characters are sent once per fighter, in `cast`, not every frame. */
export interface StageSnapshot extends Omit<StageState, 'stage' | 'brawlers' | 'projectiles'> {
  stage: number;
  run: number;
  won: boolean;
  brawlers: Omit<Brawler, 'character' | 'cpu'>[];
  projectiles: Omit<Projectile, 'character'>[];
  /** Characters of fighters that are new in this frame, by fighter id. */
  cast: Record<number, Character>;
}

/** `known` holds the fighter ids whose characters were already sent in this run. */
export function stageSnapshotOf(c: Campaign, known: Set<number>): StageSnapshot {
  const { stage, brawlers, projectiles, ...rest } = c.state;
  const cast: Record<number, Character> = {};
  for (const b of brawlers) {
    if (known.has(b.id)) continue;
    known.add(b.id);
    cast[b.id] = b.character;
  }
  return {
    ...rest,
    stage: stage.index,
    run: c.run,
    won: c.won,
    brawlers: brawlers.map(({ character: _, cpu: __, ...b }) => b),
    projectiles: projectiles.map(({ character: _, ...p }) => p),
    cast,
  };
}

/**
 * Rebuilds a stage state on the client. `cast` collects the characters sent so far in this run;
 * it is filled from the snapshot, so pass the same map every frame and clear it when `run` changes.
 */
export function stageFrom(snapshot: StageSnapshot, cast: Map<number, Character>): StageState {
  const { stage, run: _, won: __, cast: fresh, brawlers, projectiles, ...rest } = snapshot;
  for (const [id, character] of Object.entries(fresh)) cast.set(Number(id), character);
  const fallback = STAGES[stage].boss.character;
  const character = (id: number): Character => cast.get(id) ?? fallback;
  return {
    ...rest,
    stage: STAGES[stage],
    brawlers: brawlers.map((b) => ({ ...b, character: character(b.id), cpu: STAGES[stage].boss.cpu })),
    projectiles: projectiles.map((p) => ({ ...p, character: character(p.owner) })),
  };
}
