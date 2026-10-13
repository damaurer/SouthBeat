import { HIT_LINES, LineDeck, saysSomething } from './hit-lines';
import { seeded } from '../arena/painter';
import { OPPONENTS } from '../singleplayer/opponents';

describe('hit lines', () => {
  it('goes through every line before repeating one', () => {
    const deck = new LineDeck(['a', 'b', 'c']);
    const random = seeded(7);
    const first = [deck.draw(random), deck.draw(random), deck.draw(random)];
    expect([...first].sort()).toEqual(['a', 'b', 'c']);
    expect(['a', 'b', 'c']).toContain(deck.draw(random));
  });

  it('always reacts to an ultimate but not to every jab', () => {
    const random = seeded(3);
    const jabs = Array.from({ length: 200 }, () => saysSomething('light', random)).filter(Boolean).length;
    expect(jabs).toBeGreaterThan(20);
    expect(jabs).toBeLessThan(100);
    expect(saysSomething('ultimate', random)).toBeTrue();
  });

  it('gives every opponent their own hit lines', () => {
    expect(HIT_LINES.length).toBeGreaterThan(10);
    for (const o of OPPONENTS) expect(o.hitLines.length).withContext(o.id).toBeGreaterThanOrEqual(6);
  });
});
