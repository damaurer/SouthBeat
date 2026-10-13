import { defaultCharacter } from '../character/balance';
import { SPARRING_PARTNER } from '../character/sparring';
import { seeded } from '../arena/painter';
import { OPPONENTS } from '../singleplayer/opponents';
import { BEST_OF_THREE, Controls, DEFAULT_CPU, FightState, METER_MAX, NO_INPUT, ROUND_FRAMES, canUseUltimate, createFight, projectileLift, step } from './combat';
import { cpuControls, cpuFor } from './cpu';
import { roundBanner } from './rounds';

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

  it('rushes in with a dash special and hits from mid range', () => {
    const c = defaultCharacter();
    const t = createFight({ ...c, moves: { ...c.moves, special: 'deadline-dash' } }, SPARRING_PARTNER, 'bunker');
    t.fighters[0].x = 60;
    t.fighters[1].x = 110;
    step(t, [NO_INPUT, NO_INPUT]);
    step(t, [press({ special: true }), NO_INPUT]);
    settle(t);
    expect(t.fighters[0].x).toBeGreaterThan(80);
    expect(t.fighters[1].hp).toBeLessThan(t.fighters[1].maxHp);
  });

  it('lobs a keyboard in an arc that lands at range', () => {
    const c = defaultCharacter();
    const t = createFight({ ...c, moves: { ...c.moves, special: 'keyboard-lob' } }, SPARRING_PARTNER, 'bunker');
    t.fighters[0].x = 60;
    t.fighters[1].x = 150;
    step(t, [NO_INPUT, NO_INPUT]);
    step(t, [press({ special: true }), NO_INPUT]);
    let peak = 0;
    for (let i = 0; i < 80; i++) {
      step(t, [NO_INPUT, NO_INPUT]);
      peak = Math.max(peak, projectileLift(t.fighters[0]));
    }
    expect(peak).toBeGreaterThan(20);
    expect(t.fighters[1].hp).toBeLessThan(t.fighters[1].maxHp);
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

  it('lets every ladder opponent fire its ultimate only with a full action bar', () => {
    for (const o of OPPONENTS) {
      const t = createFight(defaultCharacter(), o.character, 'bunker');
      const rnd = seeded(7);
      for (let i = 0; i < ROUND_FRAMES && t.winner === null; i++) {
        const before = t.fighters[1].meter;
        step(t, [NO_INPUT, cpuControls(t, 1, rnd, o.cpu)]);
        if (t.events.some((e) => e.type === 'ultimate' && e.fighter === 1)) {
          expect(before).toBeGreaterThanOrEqual(METER_MAX);
        }
      }
    }
  });

  it('lets the CPU win against a player who does nothing', () => {
    const rnd = seeded(42);
    for (let i = 0; i < ROUND_FRAMES && s.winner === null; i++) step(s, [NO_INPUT, cpuControls(s, 1, rnd)]);
    expect(s.winner).toBe(1);
  });
});

describe('rounds', () => {
  it('plays best of three with an intro in which nobody can move', () => {
    const s = createFight(defaultCharacter(), SPARRING_PARTNER, 'bunker', BEST_OF_THREE);
    const x = s.fighters[0].x;
    for (let i = 0; i < BEST_OF_THREE.introFrames - 1; i++) step(s, [press({ right: true }), NO_INPUT]);
    expect(s.fighters[0].x).toBe(x);
    expect(roundBanner(s)).toBe('FIGHT!');
    step(s, [NO_INPUT, NO_INPUT]);
    // Round 1 to player 2.
    s.fighters[0].hp = 0;
    step(s, [NO_INPUT, NO_INPUT]);
    expect(s.roundWinner).toBe(1);
    expect(roundBanner(s)).toBe('K.O.!');
    expect(s.winner).toBeNull();
    for (let i = 0; i < BEST_OF_THREE.koFrames; i++) step(s, [NO_INPUT, NO_INPUT]);
    expect(s.wins).toEqual([0, 1]);
    expect(s.round).toBe(2);
    expect(s.fighters[0].hp).toBe(s.fighters[0].maxHp);
    expect(roundBanner(s)).toBe('Runde 2');
    // Round 2 to player 1, round 3 to player 1: player 1 wins the match.
    for (const loser of [1, 1]) {
      for (let i = 0; i < BEST_OF_THREE.introFrames; i++) step(s, [NO_INPUT, NO_INPUT]);
      s.fighters[loser].hp = 0;
      for (let i = 0; i <= BEST_OF_THREE.koFrames; i++) step(s, [NO_INPUT, NO_INPUT]);
    }
    expect(s.wins).toEqual([2, 1]);
    expect(s.winner).toBe(0);
  });
});

describe('computer opponent', () => {
  it('learns to block an attack the player keeps repeating', () => {
    const s = createFight(defaultCharacter(), SPARRING_PARTNER, 'bunker');
    const rnd = seeded(3);
    const cpu = cpuFor(DEFAULT_CPU, 'normal', 1);
    const blocked: boolean[] = [];
    for (let n = 0; n < 24; n++) {
      s.fighters[0].x = 100;
      s.fighters[1].x = 122;
      s.fighters[0].hp = s.fighters[1].hp = 200;
      for (let i = 0; i < 40; i++) {
        step(s, [press({ heavy: i === 0 }), cpuControls(s, 1, rnd, cpu)]);
        const e = s.events.find((ev) => (ev.type === 'hit' || ev.type === 'block') && ev.attacker === 0);
        if (e) blocked.push(e.type === 'block');
      }
      settle(s);
    }
    const rate = (xs: boolean[]) => xs.filter(Boolean).length / xs.length;
    expect(blocked.length).toBeGreaterThan(10);
    expect(rate(blocked.slice(-10))).toBeGreaterThan(rate(blocked.slice(0, 3)));
    expect(rate(blocked.slice(-10))).toBeGreaterThanOrEqual(0.7);
  });

  it('plays harder on higher difficulty and further up the ladder', () => {
    const easy = cpuFor(DEFAULT_CPU, 'easy', 0).skill!;
    const normal = cpuFor(DEFAULT_CPU, 'normal', 0).skill!;
    const boss = cpuFor(DEFAULT_CPU, 'normal', 4).skill!;
    const hard = cpuFor(DEFAULT_CPU, 'hard', 4).skill!;
    expect(easy).toBeLessThan(normal);
    expect(normal).toBeLessThan(boss);
    expect(boss).toBeLessThan(hard);
  });
});
