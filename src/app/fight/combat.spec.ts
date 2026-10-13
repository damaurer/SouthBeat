import { defaultCharacter } from '../character/balance';
import { SPARRING_PARTNER } from '../character/sparring';
import { seeded } from '../arena/painter';
import { Controls, FightState, METER_MAX, NO_INPUT, ROUND_FRAMES, canUseUltimate, cpuControls, createFight, step } from './combat';

function press(c: Partial<Controls>): Controls {
  return { ...NO_INPUT, ...c };
}

/** Steps until the fighters are idle again. */
function settle(s: FightState): void {
  for (let i = 0; i < 120 && (s.fighters.some((f) => f.action || f.hitstun)); i++) step(s, [NO_INPUT, NO_INPUT]);
}

function closeIn(s: FightState): void {
  s.fighters[0].x = 100;
  s.fighters[1].x = 124;
  step(s, [NO_INPUT, NO_INPUT]);
}

describe('combat', () => {
  let s: FightState;
  beforeEach(() => (s = createFight(defaultCharacter(), SPARRING_PARTNER, 'bunker')));

  it('starts with an empty action bar', () => {
    expect(s.fighters.every((f) => f.meter === 0)).toBeTrue();
    expect(canUseUltimate(s.fighters[0])).toBeFalse();
  });

  it('charges the action bar over time', () => {
    for (let i = 0; i < 600; i++) step(s, [NO_INPUT, NO_INPUT]);
    expect(s.fighters[0].meter).toBeGreaterThan(20);
    expect(s.fighters[0].meter).toBeLessThan(METER_MAX);
  });

  it('charges faster by landing and taking hits', () => {
    closeIn(s);
    const before = s.fighters.map((f) => f.meter);
    step(s, [press({ light: true }), NO_INPUT]);
    settle(s);
    expect(s.fighters[1].hp).toBeLessThan(s.fighters[1].maxHp);
    expect(s.fighters[0].meter - before[0]).toBeGreaterThan(5);
    expect(s.fighters[1].meter - before[1]).toBeGreaterThan(3);
  });

  it('ignores the ultimate button until the bar is full', () => {
    closeIn(s);
    step(s, [press({ ultimate: true }), NO_INPUT]);
    expect(s.fighters[0].action).toBeNull();
  });

  it('fires the ultimate with a full bar, empties it and hits hard', () => {
    closeIn(s);
    s.fighters[0].meter = METER_MAX;
    step(s, [press({ ultimate: true }), NO_INPUT]);
    expect(s.events.some((e) => e.type === 'ultimate')).toBeTrue();
    expect(s.fighters[0].meter).toBe(0);
    const hp = s.fighters[1].hp;
    settle(s);
    expect(hp - s.fighters[1].hp).toBeGreaterThanOrEqual(20);
  });

  it('remembers an ultimate pressed during another attack', () => {
    closeIn(s);
    s.fighters[0].meter = METER_MAX;
    step(s, [press({ light: true }), NO_INPUT]);
    step(s, [press({ ultimate: true }), NO_INPUT]);
    for (let i = 0; i < 30 && s.fighters[0].action?.slot !== 'ultimate'; i++) step(s, [NO_INPUT, NO_INPUT]);
    expect(s.fighters[0].action?.slot).toBe('ultimate');
  });

  it('cannot interrupt a started ultimate', () => {
    closeIn(s);
    s.fighters[1].meter = METER_MAX;
    step(s, [NO_INPUT, press({ ultimate: true })]);
    step(s, [press({ light: true }), NO_INPUT]);
    for (let i = 0; i < 10; i++) step(s, [NO_INPUT, NO_INPUT]);
    expect(s.fighters[1].action?.slot).toBe('ultimate');
  });

  it('ends the round on knockout and on time', () => {
    s.fighters[1].hp = 1;
    closeIn(s);
    step(s, [press({ light: true }), NO_INPUT]);
    settle(s);
    expect(s.winner).toBe(0);

    const t = createFight(defaultCharacter(), SPARRING_PARTNER, 'bunker');
    t.fighters[0].hp -= 10;
    for (let i = 0; i < ROUND_FRAMES; i++) step(t, [NO_INPUT, NO_INPUT]);
    expect(t.winner).toBe(1);
  });

  it('lets the CPU win against a player who does nothing', () => {
    const rnd = seeded(42);
    for (let i = 0; i < ROUND_FRAMES && s.winner === null; i++) step(s, [NO_INPUT, cpuControls(s, 1, rnd)]);
    expect(s.winner).toBe(1);
  });
});
