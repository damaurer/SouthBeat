import { defaultCharacter } from '../character/balance';
import { seeded } from '../arena/painter';
import { NO_INPUT } from '../fight/combat';
import { DEPTH, createStage, stepStage } from './brawl';
import { STAGES, WORLD_WIDTH, paintStage } from './stages';

describe('stage mode', () => {
  const me = defaultCharacter();

  it('has one stage per ladder boss, each three screens wide', () => {
    expect(STAGES.map((s) => s.boss.id)).toEqual(['bernd-brummer', 'konrad-kettner', 'lena-flink', 'ralf-rackwitz', 'gustav-grossmaul']);
    const p = paintStage(STAGES[4]);
    expect(p.width).toBe(WORLD_WIDTH);
  });

  it('starts with the first wave of enemies walking in', () => {
    const s = createStage(STAGES[0], [{ character: me, brain: 'human' }]);
    const enemies = s.brawlers.filter((b) => b.team === 'enemy');
    expect(enemies.length).toBe(2);
    expect(s.phase).toBe('fight');
  });

  it('walks into the depth of the floor and stays on it', () => {
    const s = createStage(STAGES[0], [{ character: me, brain: 'human' }]);
    const p = s.brawlers[0];
    const z0 = p.z;
    for (let i = 0; i < 200; i++) stepStage(s, [{ ...NO_INPUT, up: true }], seeded(1));
    expect(p.z).toBeGreaterThan(z0);
    expect(p.z).toBeLessThanOrEqual(DEPTH);
  });

  it('only hits enemies on about the same depth', () => {
    const s = createStage(STAGES[0], [{ character: me, brain: 'human' }]);
    const [p, near, far] = s.brawlers;
    s.brawlers = [p, near, far];
    Object.assign(p, { x: 100, z: 10, facing: 1 });
    // Both stand still (stunned) so only the depth decides.
    Object.assign(near, { x: 120, z: 12, hitstun: 999 });
    Object.assign(far, { x: 120, z: 26, hitstun: 999 });
    stepStage(s, [{ ...NO_INPUT, heavy: true }], seeded(1));
    for (let i = 0; i < 30; i++) stepStage(s, [NO_INPUT], seeded(1));
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.hp).toBe(far.maxHp);
  });

  it('heals with food and powers up with a keyboard', () => {
    const s = createStage(STAGES[0], [{ character: me, brain: 'human' }]);
    s.brawlers = s.brawlers.filter((b) => b.team === 'player');
    const p = s.brawlers[0];
    p.hp = 10;
    s.items = [
      { id: 1, kind: 'coffee', x: p.x, z: p.z },
      { id: 2, kind: 'keyboard', x: p.x + 1, z: p.z },
    ];
    stepStage(s, [NO_INPUT], seeded(1));
    stepStage(s, [NO_INPUT], seeded(1));
    expect(p.hp).toBe(30);
    expect(p.weapon?.kind).toBe('keyboard');
    expect(s.items.length).toBe(0);
  });

  it('ends in game over when every player is out of lives', () => {
    const s = createStage(STAGES[0], [{ character: me, brain: 'human' }]);
    const p = s.brawlers[0];
    for (let life = 0; life < 3; life++) {
      p.hp = 0;
      for (let i = 0; i < 200 && p.hp === 0 && !p.out; i++) stepStage(s, [NO_INPUT], seeded(1));
    }
    expect(p.out).toBeTrue();
    expect(s.phase).toBe('gameover');
  });

  it('lets two computer players fight through the first stage and beat its boss', () => {
    const strong = { ...me, stats: { strength: 9, speed: 5, defense: 4, stamina: 4 } };
    const s = createStage(STAGES[0], [
      { character: strong, brain: 'ally' },
      { character: strong, brain: 'ally' },
    ]);
    const random = seeded(42);
    let segments = 0;
    for (let i = 0; i < 60 * 60 * 6 && s.phase !== 'cleared' && s.phase !== 'gameover'; i++) {
      stepStage(s, [], random);
      segments = Math.max(segments, s.segment);
    }
    expect(segments).toBe(2);
    expect(s.phase).toBe('cleared');
  });
});
