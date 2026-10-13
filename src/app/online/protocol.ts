import { Character, MoveSlot } from '../character/character.model';
import { FightEvent, FightState, FighterState } from '../fight/combat';
import { Brawler, Projectile, StageState } from '../stage/brawl';
import { Campaign } from '../stage/campaign';
import { STAGES } from '../stage/stages';

/** WebSocket path of the online fight server. */
export const ONLINE_PATH = '/online';

/** A fighter as sent every frame; the character itself is sent once at the start. */
export type FighterSnapshot = Omit<FighterState, 'character'>;

export interface FightSnapshot {
  frame: number;
  winner: FightState['winner'];
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
  | { type: 'create'; name: string; mode: GameMode; rosterId: string; fighter: Character; fighterId: string | null; arenaId: string }
  | { type: 'join'; code: string; rosterId: string; fighter: Character; fighterId: string | null }
  /** Sent whenever a key changes: which way the player walks, and an attack button if one was just pressed. */
  | { type: 'input'; left: boolean; right: boolean; up: boolean; down: boolean; press: MoveSlot | null }
  /** After a fight: rematch. In the stage mode: try the stage again, or start over after the last one. */
  | { type: 'rematch' };

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
  | { type: 'room'; code: string; name: string; mode: GameMode; arenaId: string }
  | { type: 'start'; mode: GameMode; you: 0 | 1; arenaId: string; characters: [Character, Character]; rosterIds: [string, string]; fighterIds: [string | null, string | null] }
  | { type: 'state'; snapshot: FightSnapshot }
  | { type: 'stage'; snapshot: StageSnapshot }
  | { type: 'rematch-wanted'; by: 0 | 1 }
  | { type: 'opponent-left' }
  | { type: 'error'; message: string };

export function snapshotOf(state: FightState): FightSnapshot {
  const strip = ({ character: _, ...rest }: FighterState): FighterSnapshot => rest;
  return { frame: state.frame, winner: state.winner, events: state.events, fighters: [strip(state.fighters[0]), strip(state.fighters[1])] };
}

/** Rebuilds a full fight state on the client from a snapshot and the two characters. */
export function stateFrom(snapshot: FightSnapshot, characters: [Character, Character], arenaId: string): FightState {
  return {
    arenaId,
    frame: snapshot.frame,
    winner: snapshot.winner,
    events: snapshot.events,
    fighters: [
      { ...snapshot.fighters[0], character: characters[0] },
      { ...snapshot.fighters[1], character: characters[1] },
    ],
  };
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
