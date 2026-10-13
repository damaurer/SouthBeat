import { findMove } from '../character/character.model';
import { findArena } from '../arena/arenas';
import { createFight, NO_INPUT, step, FightState, Controls } from '../fight/combat';
import { defaultCharacter } from '../character/balance';
import { OPPONENTS, findOpponent } from './opponents';

function press(c: Partial<Controls>): Controls {
  return { ...NO_INPUT, ...c };
}

function fightAgainst(id: string, distance: number): FightState {
  const o = findOpponent(id)!;
  const s = createFight(o.character, defaultCharacter(), o.arenaId);
  s.fighters[0].x = 60;
  s.fighters[1].x = 60 + distance;
  step(s, [NO_INPUT, NO_INPUT]);
  return s;
}

function run(s: FightState, frames: number): number {
  let hits = 0;
  for (let i = 0; i < frames; i++) {
    step(s, [NO_INPUT, NO_INPUT]);
    hits += s.events.filter((e) => e.type === 'hit' && e.attacker === 0).length;
  }
  return hits;
}

describe('single-player opponents', () => {
  it('has four opponents and Gustav Großmaul as the final boss', () => {
    expect(OPPONENTS.map((o) => o.character.name)).toEqual(['Bernd Brummer', 'Konrad Kettner', 'Lena Flink', 'Ralf Rackwitz', 'Gustav Großmaul']);
    expect(OPPONENTS.at(-1)!.boss).toBeTrue();
  });

  it('only uses existing moves, arenas and speech lines', () => {
    for (const o of OPPONENTS) {
      for (const [slot, id] of Object.entries(o.character.moves)) expect(findMove(id)?.slot).withContext(`${o.id} ${slot}`).toBe(slot as never);
      expect(findArena(o.arenaId).id).toBe(o.arenaId);
      expect(o.lines.length).toBeGreaterThan(0);
    }
  });

  it('Bernd pushes far away with his belly', () => {
    const s = fightAgainst('bernd-brummer', 26);
    step(s, [press({ special: true }), NO_INPUT]);
    run(s, 30);
    expect(s.fighters[1].x - s.fighters[0].x).toBeGreaterThan(55);
  });

  it("Konrad's tank rolls across the whole arena", () => {
    const s = fightAgainst('konrad-kettner', 150);
    step(s, [press({ special: true }), NO_INPUT]);
    expect(run(s, 120)).toBe(1);
  });

  it('Lena lands a three-hit combo with one button press', () => {
    const s = fightAgainst('lena-flink', 24);
    step(s, [press({ light: true }), NO_INPUT]);
    expect(run(s, 30)).toBe(3);
  });

  it("Gustav's tomato needs time to fly before it hits", () => {
    const s = fightAgainst('gustav-grossmaul', 120);
    step(s, [press({ special: true }), NO_INPUT]);
    expect(run(s, 15)).toBe(0);
    expect(run(s, 60)).toBe(1);
  });
});
