import { defaultCharacter } from '../character/balance';
import { SPARRING_PARTNER } from '../character/sparring';
import { Controls, FightState, NO_INPUT, createFight, step } from './combat';

const press = (c: Partial<Controls>): Controls => ({ ...NO_INPUT, ...c });

/** Fighter 0 on the left facing right, fighter 1 close by facing left (so "back" for fighter 1 is right). */
function close(): FightState {
  const s = createFight(defaultCharacter(), SPARRING_PARTNER, 'bunker');
  s.fighters[0].x = 100;
  s.fighters[1].x = 124;
  step(s, [NO_INPUT, NO_INPUT]);
  return s;
}

/** Runs frames with fighter 0 pressing once and fighter 1 holding a guard. */
function attackInto(s: FightState, attack: Partial<Controls>, guard: Partial<Controls>, frames = 40): void {
  step(s, [press(attack), press(guard)]);
  const hold = { ...attack, light: false, heavy: false, kick: false, special: false, ultimate: false };
  for (let i = 0; i < frames; i++) step(s, [press(hold), press(guard)]);
}

describe('street fighter rules', () => {
  it('jumps up and lands again', () => {
    const s = close();
    step(s, [press({ up: true }), NO_INPUT]);
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      step(s, [NO_INPUT, NO_INPUT]);
      peak = Math.max(peak, s.fighters[0].y);
    }
    expect(peak).toBeGreaterThan(25);
    expect(s.fighters[0].y).toBe(0);
  });

  it('blocks a standing attack by holding back', () => {
    const s = close();
    attackInto(s, { heavy: true }, { right: true });
    expect(s.fighters[1].hp).toBe(s.fighters[1].maxHp);
    expect(s.fighters[1].blockstun + s.fighters[1].hitstun).toBe(0);
  });

  it('takes chip damage when blocking a special', () => {
    const s = close();
    attackInto(s, { special: true }, { right: true }, 60);
    const f = s.fighters[1];
    expect(f.hp).toBeLessThan(f.maxHp);
    expect(f.maxHp - f.hp).toBeLessThan(5);
  });

  it('sweeps a standing guard but not a crouching one', () => {
    const standing = close();
    attackInto(standing, { down: true, kick: true }, { right: true });
    expect(standing.fighters[1].hp).toBeLessThan(standing.fighters[1].maxHp);

    const crouching = close();
    attackInto(crouching, { down: true, kick: true }, { right: true, down: true });
    expect(crouching.fighters[1].hp).toBe(crouching.fighters[1].maxHp);
  });

  it('knocks down with a sweep', () => {
    const s = close();
    step(s, [press({ down: true, kick: true }), NO_INPUT]);
    let down = false;
    for (let i = 0; i < 30; i++) {
      step(s, [press({ down: true }), NO_INPUT]);
      down ||= s.fighters[1].knockedDown;
    }
    expect(down).toBeTrue();
  });

  it('beats a crouching guard with a jump attack', () => {
    const s = close();
    s.fighters[0].x = 80;
    step(s, [press({ up: true, right: true }), press({ right: true, down: true })]);
    for (let i = 0; i < 14; i++) step(s, [NO_INPUT, press({ right: true, down: true })]);
    attackInto(s, { kick: true }, { right: true, down: true });
    expect(s.fighters[1].hp).toBeLessThan(s.fighters[1].maxHp);
  });

  it('jumps over a thrown projectile', () => {
    const s = createFight(defaultCharacter(), SPARRING_PARTNER, 'bunker');
    s.fighters[0].x = 60;
    s.fighters[1].x = 130;
    step(s, [NO_INPUT, NO_INPUT]);
    step(s, [press({ special: true }), NO_INPUT]);
    // Jump once, just before the coffee arrives.
    for (let i = 0; i < 70; i++) step(s, [NO_INPUT, press({ up: i === 14 })]);
    expect(s.fighters[1].hp).toBe(s.fighters[1].maxHp);
  });

  it('fires the special with the down, down-forward, forward motion', () => {
    const s = close();
    for (const c of [{ down: true }, { down: true, right: true }, { right: true }]) step(s, [press(c), NO_INPUT]);
    step(s, [press({ light: true }), NO_INPUT]);
    step(s, [NO_INPUT, NO_INPUT]);
    expect(s.fighters[0].action?.slot).toBe('special');
  });

  it('catches a jump-in with the crouching heavy attack', () => {
    const s = close();
    s.fighters[1].x = 130;
    step(s, [NO_INPUT, press({ up: true, left: true })]);
    for (let i = 0; i < 6; i++) step(s, [NO_INPUT, NO_INPUT]);
    attackInto(s, { down: true, heavy: true }, {}, 20);
    expect(s.fighters[1].hp).toBeLessThan(s.fighters[1].maxHp);
  });
});
