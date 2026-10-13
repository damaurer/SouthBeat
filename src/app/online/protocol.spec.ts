import { createFight, step, NO_INPUT, BEST_OF_THREE } from '../fight/combat';
import { defaultCharacter } from '../character/balance';
import { SPARRING_PARTNER } from '../character/sparring';
import { seeded } from '../arena/painter';
import { Character } from '../character/character.model';
import { createCampaign, stepCampaign } from '../stage/campaign';
import { newRoomCode, normalizeCode, snapshotOf, stageFrom, stageSnapshotOf, stateFrom } from './protocol';

describe('online protocol', () => {
  it('sends fighters without their characters and rebuilds the same state', () => {
    const me = defaultCharacter();
    const state = createFight(me, SPARRING_PARTNER, 'bunker', BEST_OF_THREE);
    for (let i = 0; i < 130; i++) step(state, [{ ...NO_INPUT, right: true }, NO_INPUT]);
    const wire = JSON.parse(JSON.stringify(snapshotOf(state)));
    expect('character' in wire.fighters[0]).toBeFalse();
    const rebuilt = stateFrom(wire, [me, SPARRING_PARTNER], 'bunker');
    expect(rebuilt).toEqual(JSON.parse(JSON.stringify(state)));
  });

  it('sends each stage character once and rebuilds the same stage state', () => {
    const me = defaultCharacter();
    const c = createCampaign([
      { character: me, brain: 'human' },
      { character: SPARRING_PARTNER, brain: 'human' },
    ]);
    const known = new Set<number>();
    const cast = new Map<number, Character>();
    const random = seeded(3);
    let wire = JSON.parse(JSON.stringify(stageSnapshotOf(c, known)));
    expect(Object.keys(wire.cast).length).toBe(c.state.brawlers.length);
    stageFrom(wire, cast);
    for (let i = 0; i < 40; i++) stepCampaign(c, [{ ...NO_INPUT, right: true }, NO_INPUT], random);
    wire = JSON.parse(JSON.stringify(stageSnapshotOf(c, known)));
    expect(wire.cast).toEqual({});
    expect('character' in wire.brawlers[0]).toBeFalse();
    const rebuilt = stageFrom(wire, cast);
    expect(rebuilt.stage).toBe(c.state.stage);
    expect(rebuilt.brawlers.map((b) => [b.name, b.x, b.hp, b.character.name])).toEqual(c.state.brawlers.map((b) => [b.name, b.x, b.hp, b.character.name]));
  });

  it('makes four-letter room codes without look-alike letters', () => {
    const random = seeded(1);
    for (let i = 0; i < 100; i++) expect(newRoomCode(random)).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(normalizeCode(' abcd ')).toBe('ABCD');
  });
});
