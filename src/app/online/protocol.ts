import { Character, MoveSlot } from '../character/character.model';
import { FightEvent, FightState, FighterState } from '../fight/combat';

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

export type ClientMessage =
  | { type: 'create'; fighter: Character; fighterId: string | null; arenaId: string }
  | { type: 'join'; code: string; fighter: Character; fighterId: string | null }
  /** Sent whenever a key changes: which way the player walks, and an attack button if one was just pressed. */
  | { type: 'input'; left: boolean; right: boolean; press: MoveSlot | null }
  | { type: 'rematch' };

export type ServerMessage =
  | { type: 'room'; code: string }
  | { type: 'start'; you: 0 | 1; arenaId: string; characters: [Character, Character]; fighterIds: [string | null, string | null] }
  | { type: 'state'; snapshot: FightSnapshot }
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
