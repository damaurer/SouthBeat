import { defaultCharacter } from '../app/character/balance';
import { GameDataError, GameDataRules, emptyGameData } from './game-data';

describe('GameDataRules', () => {
  let n: number;
  let rules: GameDataRules;
  beforeEach(() => {
    n = 0;
    rules = new GameDataRules(emptyGameData(), () => `id${++n}`, () => new Date('2026-10-13T08:00:00Z'));
  });

  it('creates fighters and strips unknown fields', () => {
    const f = rules.createFighter({ ...defaultCharacter(), isAdmin: true });
    expect(f.id).toBe('id1');
    expect((f as unknown as Record<string, unknown>)['isAdmin']).toBeUndefined();
    expect(rules.listFighters().length).toBe(1);
  });

  it('rejects fighters that break the balance rules', () => {
    const cheat = { ...defaultCharacter(), stats: { strength: 10, speed: 10, defense: 10, stamina: 10 } };
    expect(() => rules.createFighter(cheat)).toThrowMatching((e) => e instanceof GameDataError && e.status === 400);
  });

  it('updates an existing fighter and 404s for unknown ids', () => {
    const f = rules.createFighter(defaultCharacter());
    rules.updateFighter(f.id, { ...defaultCharacter(), name: 'Neo' });
    expect(rules.getFighter(f.id).fighter.name).toBe('Neo');
    expect(() => rules.updateFighter('nope', defaultCharacter())).toThrowMatching((e) => (e as GameDataError).status === 404);
  });

  it('records matches and builds statistics', () => {
    const a = rules.createFighter({ ...defaultCharacter(), name: 'Ada' });
    const b = rules.createFighter({ ...defaultCharacter(), name: 'Linus' });
    rules.recordMatch({ winnerId: a.id, loserId: b.id, arenaId: 'bunker' });
    rules.recordMatch({ winnerId: a.id, loserId: b.id, arenaId: 'rooftop' });
    rules.recordMatch({ winnerId: b.id, loserId: a.id, arenaId: 'bunker' });

    expect(rules.statsFor(a.id)).toEqual({ matches: 3, wins: 2, losses: 1 });
    const summary = rules.summary();
    expect(summary.matches).toBe(3);
    expect(summary.byArena).toEqual({ bunker: 2, rooftop: 1 });
    expect(summary.leaderboard.map((e) => e.name)).toEqual(['Ada', 'Linus']);
  });

  it('tracks beaten single-player opponents', () => {
    const a = rules.createFighter(defaultCharacter());
    rules.recordLadder(a.id, { opponentId: 'bernd-brummer', won: false });
    expect(rules.getFighter(a.id).ladderBeaten).toEqual([]);
    rules.recordLadder(a.id, { opponentId: 'bernd-brummer', won: true });
    rules.recordLadder(a.id, { opponentId: 'bernd-brummer', won: true });
    expect(rules.getFighter(a.id).ladderBeaten).toEqual(['bernd-brummer']);
    expect(() => rules.recordLadder(a.id, { opponentId: 'chef', won: true })).toThrowError(GameDataError);
  });

  it('stores the drawn projectile and rejects broken drawings', () => {
    const c = defaultCharacter();
    const art = c.projectileArt!.map((row, y) => (y === 0 ? '444444444444' : row));
    expect(rules.createFighter({ ...c, projectileArt: art }).projectileArt).toEqual(art);
    expect(() => rules.createFighter({ ...c, projectileArt: ['<script>'] })).toThrowError(GameDataError);
  });

  it('rejects signature moves of opponents for players', () => {
    const c = defaultCharacter();
    expect(() => rules.createFighter({ ...c, moves: { ...c.moves, special: 'tank-roll' } })).toThrowError(GameDataError);
  });

  it('rejects invalid matches', () => {
    const a = rules.createFighter(defaultCharacter());
    expect(() => rules.recordMatch({ winnerId: a.id, loserId: a.id, arenaId: 'bunker' })).toThrowError(GameDataError);
    expect(() => rules.recordMatch({ winnerId: a.id, loserId: 'x', arenaId: 'bunker' })).toThrowError(GameDataError);
    const b = rules.createFighter(defaultCharacter());
    expect(() => rules.recordMatch({ winnerId: a.id, loserId: b.id, arenaId: 'mars' })).toThrowError(GameDataError);
  });
});
