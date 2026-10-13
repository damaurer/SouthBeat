import { STAT_BUDGET, STAT_MAX, STAT_MIN, adjustStat, characterErrors, defaultCharacter, remainingPoints, statErrors } from './balance';

describe('balance', () => {
  it('default character is valid and leaves points to spend', () => {
    const c = defaultCharacter();
    expect(characterErrors(c)).toEqual([]);
    expect(remainingPoints(c.stats)).toBe(STAT_BUDGET - 20);
  });

  it('does not raise a stat above the maximum', () => {
    let stats = { strength: STAT_MAX, speed: 1, defense: 1, stamina: 1 };
    stats = adjustStat(stats, 'strength', 1);
    expect(stats.strength).toBe(STAT_MAX);
  });

  it('does not lower a stat below the minimum', () => {
    const stats = adjustStat({ strength: STAT_MIN, speed: 5, defense: 5, stamina: 5 }, 'strength', -1);
    expect(stats.strength).toBe(STAT_MIN);
  });

  it('does not spend more than the budget', () => {
    let stats = defaultCharacter().stats;
    for (let i = 0; i < 20; i++) stats = adjustStat(stats, 'speed', 1);
    expect(remainingPoints(stats)).toBe(0);
    expect(adjustStat(stats, 'defense', 1)).toBe(stats);
  });

  it('rejects tampered stats', () => {
    expect(statErrors({ strength: 15, speed: 5, defense: 5, stamina: 5 }).length).toBeGreaterThan(0);
    expect(statErrors({ strength: 10, speed: 10, defense: 10, stamina: 10 }).length).toBeGreaterThan(0);
  });

  it('rejects a move in the wrong slot', () => {
    const c = defaultCharacter();
    c.moves.light = 'haymaker';
    expect(characterErrors(c).length).toBe(1);
  });
});

describe('appearance validation', () => {
  it('rejects unknown styles and colors, e.g. from an old save', () => {
    const c = defaultCharacter();
    const old = { ...c, appearance: { ...c.appearance, beardStyle: undefined } } as unknown as typeof c;
    expect(characterErrors(old)).toContain('Ungültiges Aussehen.');
    expect(characterErrors({ ...c, appearance: { ...c.appearance, eyeColor: 'red' } })).toContain('Ungültiges Aussehen.');
  });
});
