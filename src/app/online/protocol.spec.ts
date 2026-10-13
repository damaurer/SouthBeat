import { createFight, step, NO_INPUT } from '../fight/combat';
import { defaultCharacter } from '../character/balance';
import { SPARRING_PARTNER } from '../character/sparring';
import { seeded } from '../arena/painter';
import { newRoomCode, normalizeCode, snapshotOf, stateFrom } from './protocol';

describe('online protocol', () => {
  it('sends fighters without their characters and rebuilds the same state', () => {
    const me = defaultCharacter();
    const state = createFight(me, SPARRING_PARTNER, 'bunker');
    for (let i = 0; i < 30; i++) step(state, [{ ...NO_INPUT, right: true }, NO_INPUT]);
    const wire = JSON.parse(JSON.stringify(snapshotOf(state)));
    expect('character' in wire.fighters[0]).toBeFalse();
    const rebuilt = stateFrom(wire, [me, SPARRING_PARTNER], 'bunker');
    expect(rebuilt).toEqual(JSON.parse(JSON.stringify(state)));
  });

  it('makes four-letter room codes without look-alike letters', () => {
    const random = seeded(1);
    for (let i = 0; i < 100; i++) expect(newRoomCode(random)).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(normalizeCode(' abcd ')).toBe('ABCD');
  });
});
