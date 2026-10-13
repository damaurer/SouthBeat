import { MoveSlot } from '../character/character.model';
import type { Sound } from '../shared/sound';
import { FightState, FighterState, METER_MAX } from './combat';
import { HIT_LINE_COOLDOWN, LineDeck, saysSomething } from './hit-lines';
import { roundBanner } from './rounds';

/** One fighter's bars on the HUD. Rounded, so the HUD only changes when the picture does. */
export interface FighterHud {
  name: string;
  hp: number;
  maxHp: number;
  meter: number;
  ready: boolean;
}

export function fighterHud(f: FighterState): FighterHud {
  return { name: f.character.name, hp: Math.ceil(f.hp), maxHp: f.maxHp, meter: Math.floor(f.meter), ready: f.meter >= METER_MAX };
}

/** What a frame of the duel means for the player: sounds, the round call and who says something. */
export interface FrameFeedback {
  /** "Runde 1", "FIGHT!", "K.O.!" … or null while fighting. */
  call: string | null;
  /** Set when an ultimate starts: "Name: Ultimate!". */
  ultimate: string | null;
  /** A fighter who just got hit and says something about it. */
  line: { fighter: 0 | 1; text: string } | null;
}

/**
 * The parts of a duel that are the same offline and online: sounds for hits, blocks,
 * ultimates and round calls, and the lines fighters say when they get hit. Speech is cosmetic
 * and uses its own random numbers, so it never touches the fight.
 */
export class DuelFeedback {
  private lastCall: string | null = null;
  private lastLine: [number, number] = [-Infinity, -Infinity];
  private decks: [LineDeck, LineDeck];

  constructor(
    private readonly sound: Sound,
    hitLines: [readonly string[], readonly string[]],
    private readonly random: () => number,
  ) {
    this.decks = [new LineDeck(hitLines[0]), new LineDeck(hitLines[1])];
  }

  /** Call once per frame after `step` (or after a frame from the server). */
  frame(state: FightState): FrameFeedback {
    let ultimate: string | null = null;
    let line: FrameFeedback['line'] = null;
    for (const e of state.events) {
      if (e.type === 'hit') {
        const victim = (1 - e.attacker) as 0 | 1;
        line = this.hitLine(victim, e.slot, state.frame) ?? line;
        this.sound.hit(e.slot);
      } else if (e.type === 'block') {
        this.sound.play('block');
      } else if (e.type === 'ultimate') {
        ultimate = `${state.fighters[e.fighter].character.name}: ${e.move.name}!`;
        this.sound.play('ultimate');
      }
    }
    const call = roundBanner(state);
    if (call !== this.lastCall) {
      if (call === 'FIGHT!') this.sound.play('fight');
      else if (call?.startsWith('Runde') || call === 'Finale Runde') this.sound.play('round');
      else if (call === 'K.O.!' || call === 'Zeit!') this.sound.play('ko');
      this.lastCall = call;
    }
    return { call, ultimate, line };
  }

  /** Now and then a fighter who takes a hit says something about it. */
  private hitLine(fighter: 0 | 1, slot: MoveSlot, frame: number): FrameFeedback['line'] {
    if (frame - this.lastLine[fighter] < HIT_LINE_COOLDOWN || !saysSomething(slot, this.random)) return null;
    this.lastLine[fighter] = frame;
    return { fighter, text: this.decks[fighter].draw(this.random) };
  }
}
