import { defaultCharacter } from '../character/balance';
import { seeded } from '../arena/painter';
import { BOSS_ID, OWN_FIGHTER, RANDOM_FIGHTER, builtInFighter, resolvePick, roster } from './roster';

describe('roster', () => {
  const me = { ...defaultCharacter(), name: 'Paula' };

  it('starts with the own fighter, then the sparring partner and the ladder opponents', () => {
    const ids = roster(me, []).map((e) => e.id);
    expect(ids).toEqual([OWN_FIGHTER, 'sparring', 'bernd-brummer', 'konrad-kettner', 'lena-flink', 'ralf-rackwitz', BOSS_ID]);
    expect(roster(me, [])[0].name).toBe('Paula');
  });

  it('unlocks the boss only after beating him', () => {
    expect(roster(me, []).find((e) => e.id === BOSS_ID)!.locked).toBeTrue();
    expect(roster(me, [BOSS_ID]).find((e) => e.id === BOSS_ID)!.locked).toBeFalse();
  });

  it('never hands out a locked fighter, not even at random', () => {
    const entries = roster(me, []);
    const random = seeded(5);
    for (let i = 0; i < 100; i++) expect(resolvePick(RANDOM_FIGHTER, entries, random).locked).toBeFalse();
    expect(resolvePick(BOSS_ID, entries, random).id).toBe(OWN_FIGHTER);
  });

  it('knows built-in fighters by id but not the own fighter', () => {
    expect(builtInFighter('bernd-brummer')!.name).toBe('Bernd Brummer');
    expect(builtInFighter(OWN_FIGHTER)).toBeUndefined();
  });
});
