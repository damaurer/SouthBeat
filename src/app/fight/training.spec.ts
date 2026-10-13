import { defaultCharacter } from '../character/balance';
import { SPARRING_PARTNER } from '../character/sparring';
import { Painter } from '../arena/painter';
import { FPS, NO_INPUT, ROUND_FRAMES, createFight, step } from './combat';
import { NO_COMBO, TRAINING_RULES, afterTrainingStep, drawBoxes, dummyControls, dummyReeling, inputEntry, logInput } from './training';

describe('training', () => {
  const setup = () => {
    const state = createFight(defaultCharacter(), SPARRING_PARTNER, 'bunker', TRAINING_RULES);
    state.fighters[1].x = state.fighters[0].x + 24;
    return state;
  };

  it('never lets the dummy go down, even under ultimates', () => {
    const state = setup();
    const options = { dummy: 'stand' as const, fullMeter: true };
    let combo = NO_COMBO;
    for (let i = 0; i < 1200; i++) {
      const reeling = dummyReeling(state);
      state.fighters[1].hp = Math.min(state.fighters[1].hp, 5);
      const press = i % 30 === 0 ? { ...NO_INPUT, right: true, ultimate: true } : i % 7 === 0 ? { ...NO_INPUT, right: true, heavy: true } : { ...NO_INPUT, right: true };
      step(state, [press, dummyControls(state, 'stand')]);
      combo = afterTrainingStep(state, options, combo, reeling);
      expect(state.fighters[1].hp).toBeGreaterThan(0);
      expect(state.roundWinner).toBeNull();
    }
    expect(state.winner).toBeNull();
    expect(combo.hits).toBeGreaterThan(0);
  });

  it('counts a hit on a reeling dummy as part of the combo', () => {
    const state = setup();
    const options = { dummy: 'stand' as const, fullMeter: false };
    state.events = [{ type: 'hit', attacker: 0, slot: 'heavy', damage: 9 }];
    let combo = afterTrainingStep(state, options, NO_COMBO, false);
    expect(combo).toEqual(jasmine.objectContaining({ hits: 1, damage: 9 }));
    state.events = [{ type: 'hit', attacker: 0, slot: 'light', damage: 4 }];
    combo = afterTrainingStep(state, options, combo, true);
    expect(combo).toEqual(jasmine.objectContaining({ hits: 2, damage: 13 }));
    combo = afterTrainingStep(state, options, combo, false);
    expect(combo.hits).toBe(1);
    expect(combo.damage).toBe(4);
  });

  it('loops the clock and keeps the action bar full when asked', () => {
    const state = setup();
    state.frame = ROUND_FRAMES - 1;
    step(state, [NO_INPUT, NO_INPUT]);
    afterTrainingStep(state, { dummy: 'stand', fullMeter: true }, NO_COMBO, false);
    expect(state.frame).toBe(FPS);
    expect(state.fighters[0].meter).toBe(100);
  });

  it('blocks low against sweeps and high against the rest', () => {
    const state = setup();
    expect(dummyControls(state, 'block')).toEqual({ ...NO_INPUT, right: true, down: false });
    state.fighters[0].action = { level: 'low' } as never;
    expect(dummyControls(state, 'block').down).toBeTrue();
  });

  it('writes inputs seen from the fighter, forward is always →', () => {
    const state = setup();
    const f = state.fighters[0];
    expect(inputEntry(f, { ...NO_INPUT, down: true, right: true })).toBe('↘');
    f.facing = -1;
    expect(inputEntry(f, { ...NO_INPUT, down: true, left: true, light: true })).toBe('↘+L');
    expect(logInput(['↓'], '↓', '↓')).toEqual(['↓']);
    expect(logInput(['↓'], '↘', '↓')).toEqual(['↘', '↓']);
  });

  it('draws the boxes inside the picture', () => {
    const state = setup();
    const p = new Painter(240, 135);
    expect(() => drawBoxes(p, state)).not.toThrow();
  });
});
