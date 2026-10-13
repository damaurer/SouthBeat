import { defaultCharacter } from '../character/balance';
import { SPARRING_PARTNER } from '../character/sparring';
import type { Sound } from '../shared/sound';
import { BEST_OF_THREE, createFight } from './combat';
import { DuelFeedback, fighterHud } from './feedback';

describe('DuelFeedback', () => {
  const played: string[] = [];
  const sound = { play: (s: string) => played.push(s), hit: (s: string) => played.push('hit:' + s) } as unknown as Sound;

  beforeEach(() => (played.length = 0));

  it('plays each round call once and names the ultimate', () => {
    const state = createFight(defaultCharacter(), SPARRING_PARTNER, 'bunker', BEST_OF_THREE);
    const feedback = new DuelFeedback(sound, [['Au!'], ['Autsch!']], () => 0);
    expect(feedback.frame(state).call).toBe('Runde 1');
    feedback.frame(state);
    expect(played).toEqual(['round']);
    state.events = [{ type: 'ultimate', fighter: 0, move: { name: 'Freitags-Deploy' } as never }];
    expect(feedback.frame(state).ultimate).toBe(`${defaultCharacter().name}: Freitags-Deploy!`);
  });

  it('lets a hit fighter say a line, then waits a while', () => {
    const state = createFight(defaultCharacter(), SPARRING_PARTNER, 'bunker', BEST_OF_THREE);
    const feedback = new DuelFeedback(sound, [['Au!'], ['Autsch!']], () => 0);
    state.events = [{ type: 'hit', attacker: 0, slot: 'heavy', damage: 8 }];
    expect(feedback.frame(state).line).toEqual({ fighter: 1, text: 'Autsch!' });
    expect(feedback.frame(state).line).toBeNull();
    expect(played).toContain('hit:heavy');
  });

  it('rounds the bars so the HUD only changes when the picture does', () => {
    const f = { ...createFight(defaultCharacter(), SPARRING_PARTNER, 'bunker').fighters[0], hp: 50.4, meter: 99.9 };
    expect(fighterHud(f)).toEqual(jasmine.objectContaining({ hp: 51, meter: 99, ready: false }));
  });
});
