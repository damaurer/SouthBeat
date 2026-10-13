import { defaultCharacter } from '../character/balance';
import { seeded } from '../arena/painter';
import { NO_INPUT } from '../fight/combat';
import { STAGE_BREAK, createCampaign, stepCampaign } from './campaign';
import { STAGES } from './stages';

describe('stage campaign', () => {
  it('moves on to the next stage after a short break, keeping the lives', () => {
    const c = createCampaign([{ character: defaultCharacter(), brain: 'human' }]);
    c.state.brawlers[0].lives = 2;
    // Pretend the boss is beaten.
    c.state.phase = 'cleared';
    let cleared: string | null = null;
    for (let i = 0; i < STAGE_BREAK + 2; i++) {
      const now = stepCampaign(c, [NO_INPUT], seeded(1));
      cleared ??= now;
    }
    expect(cleared).toBe(STAGES[0].boss.id);
    expect(c.state.stage.index).toBe(1);
    expect(c.run).toBe(2);
    expect(c.state.brawlers[0].lives).toBe(2);
  });

  it('is won after the last stage', () => {
    const c = createCampaign([{ character: defaultCharacter(), brain: 'human' }], STAGES.length - 1);
    c.state.phase = 'cleared';
    for (let i = 0; i < STAGE_BREAK + 2; i++) stepCampaign(c, [NO_INPUT], seeded(1));
    expect(c.won).toBeTrue();
  });
});
