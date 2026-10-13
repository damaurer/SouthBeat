import { Controls } from '../fight/combat';
import { StagePlayer, StageState, createStage, stepStage } from './brawl';
import { STAGES } from './stages';

/** Frames between beating a boss and the next stage starting. */
export const STAGE_BREAK = 180;

/**
 * A run through all stages in a row. Used by the local stage mode and by the online server,
 * so both move on to the next stage the same way.
 */
export interface Campaign {
  team: StagePlayer[];
  state: StageState;
  /** Frame at which the next stage starts, once the current one is cleared. */
  advanceAt: number;
  won: boolean;
  /** Counts up with every stage started, so a viewer can tell a new stage from the old one. */
  run: number;
}

export function createCampaign(team: StagePlayer[], index = 0): Campaign {
  return { team, state: createStage(STAGES[index], team), advanceAt: 0, won: false, run: 1 };
}

/** One frame. Returns the boss id when a stage was just cleared. */
export function stepCampaign(c: Campaign, controls: Controls[], random: () => number): string | null {
  const s = c.state;
  if (c.won) return null;
  stepStage(s, controls, random);
  if (s.phase !== 'cleared') return null;
  let cleared: string | null = null;
  if (c.advanceAt === 0) {
    c.advanceAt = s.frame + STAGE_BREAK;
    cleared = s.stage.boss.id;
  }
  // stepStage stops counting frames once a stage is over, so count here.
  s.frame++;
  if (s.frame >= c.advanceAt) {
    if (s.stage.index + 1 < STAGES.length) startStage(c, s.stage.index + 1, true);
    else c.won = true;
  }
  return cleared;
}

/** Starts a stage; with `carry`, lives and action bars come along from the current one. */
export function startStage(c: Campaign, index: number, carry = false): void {
  c.state = createStage(STAGES[index], c.team, carry ? c.state.brawlers : undefined);
  c.advanceAt = 0;
  c.won = false;
  c.run++;
}
