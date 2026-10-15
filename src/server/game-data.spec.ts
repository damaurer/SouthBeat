import { defaultCharacter } from '../app/character/balance';
import { GameData, GameDataError, GameDataRules, emptyGameData, fnv1a, migrateOpponentIds } from './game-data';

describe('GameDataRules', () => {
  let n: number;
  let rules: GameDataRules;
  let data: GameData;
  beforeEach(() => {
    n = 0;
    data = emptyGameData();
    rules = new GameDataRules(data, () => `id${++n}`, () => new Date('2026-10-13T08:00:00Z'), (t) => `hash:${t}`);
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
    rules.updateFighter(f.id, { ...defaultCharacter(), name: 'Neo' }, f.editToken);
    expect(rules.getFighter(f.id).fighter.name).toBe('Neo');
    expect(() => rules.updateFighter('nope', defaultCharacter(), f.editToken)).toThrowMatching((e) => (e as GameDataError).status === 404);
  });

  it('only lets the owner change a fighter and never shows the token', () => {
    const f = rules.createFighter(defaultCharacter());
    expect(f.editToken.length).toBeGreaterThan(5);
    expect(data.fighters[0].tokenHash).toBe(`hash:${f.editToken}`);
    for (const wrong of [undefined, '', 'guess', 123]) {
      expect(() => rules.updateFighter(f.id, { ...defaultCharacter(), name: 'Hijack' }, wrong)).toThrowMatching((e) => (e as GameDataError).status === 403);
      expect(() => rules.recordLadder(f.id, { opponentId: 'bernd-brummer', won: true }, wrong)).toThrowMatching((e) => (e as GameDataError).status === 403);
    }
    expect(rules.getFighter(f.id).fighter.name).not.toBe('Hijack');
    expect(JSON.stringify(rules.listFighters())).not.toContain('hash:');
    expect(JSON.stringify(rules.getFighter(f.id))).not.toContain('hash:');
    expect(rules.owns(f.id, f.editToken)).toBeTrue();
    expect(rules.owns(f.id, 'guess')).toBeFalse();
  });

  it('hands a token to the first save of a fighter from before tokens existed', () => {
    const f = rules.createFighter(defaultCharacter());
    delete data.fighters[0].tokenHash;
    expect(() => rules.recordLadder(f.id, { opponentId: 'bernd-brummer', won: true }, undefined)).toThrowError(GameDataError);
    const claimed = rules.updateFighter(f.id, defaultCharacter(), undefined);
    expect('editToken' in claimed).toBeTrue();
    expect(() => rules.updateFighter(f.id, defaultCharacter(), undefined)).toThrowMatching((e) => (e as GameDataError).status === 403);
  });

  it('refuses ladder opponents that are still locked', () => {
    const f = rules.createFighter(defaultCharacter());
    expect(() => rules.recordLadder(f.id, { opponentId: 'gustav-grossmaul', won: true }, f.editToken)).toThrowMatching((e) => (e as GameDataError).status === 403);
    rules.recordLadder(f.id, { opponentId: 'bernd-brummer', won: true }, f.editToken);
    expect(() => rules.recordLadder(f.id, { opponentId: 'konrad-kettner', won: false }, f.editToken)).not.toThrow();
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
    const t = a.editToken;
    rules.recordLadder(a.id, { opponentId: 'bernd-brummer', won: false }, t);
    expect(rules.getFighter(a.id).ladderBeaten).toEqual([]);
    rules.recordLadder(a.id, { opponentId: 'bernd-brummer', won: true }, t);
    rules.recordLadder(a.id, { opponentId: 'bernd-brummer', won: true }, t);
    expect(rules.getFighter(a.id).ladderBeaten).toEqual(['bernd-brummer']);
    expect(() => rules.recordLadder(a.id, { opponentId: 'chef', won: true }, t)).toThrowError(GameDataError);
  });

  it('stores the drawn projectile and rejects broken drawings', () => {
    const c = defaultCharacter();
    const art = c.projectileArt!.map((row, y) => (y === 0 ? '444444444444' : row));
    expect(rules.createFighter({ ...c, projectileArt: art }).projectileArt).toEqual(art);
    expect(() => rules.createFighter({ ...c, projectileArt: ['<script>'] })).toThrowError(GameDataError);
  });

  it('stores the slider proportions and rejects values out of range', () => {
    const c = defaultCharacter();
    const shape = { height: 3, belly: -2, nose: 1 };
    expect(rules.createFighter({ ...c, appearance: { ...c.appearance, shape } }).appearance.shape).toEqual(shape);
    for (const bad of [{ height: 4 }, { height: 1.5 }, { wings: 1 }, { height: '2' }, [1]]) {
      expect(() => rules.createFighter({ ...c, appearance: { ...c.appearance, shape: bad as never } })).toThrowError(GameDataError);
    }
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

  it('folds old matches into totals without changing anyone\'s record', () => {
    const a = rules.createFighter(defaultCharacter());
    const b = rules.createFighter({ ...defaultCharacter(), name: 'Zweiter' });
    for (let i = 0; i < 7; i++) rules.recordMatch({ winnerId: i % 3 ? a.id : b.id, loserId: i % 3 ? b.id : a.id, arenaId: i % 2 ? 'bunker' : 'rooftop' });
    const before = { a: rules.statsFor(a.id), b: rules.statsFor(b.id), summary: rules.summary(), list: rules.listFighters().map((f) => f.record) };
    rules.compact(2);
    expect(data.matches.length).toBe(2);
    expect(data.archived?.matches).toBe(5);
    expect(rules.statsFor(a.id)).toEqual(before.a);
    expect(rules.statsFor(b.id)).toEqual(before.b);
    expect(rules.summary()).toEqual(before.summary);
    expect(rules.listFighters().map((f) => f.record)).toEqual(before.list);
  });

  it('thins old ladder results to the first win per opponent', () => {
    const a = rules.createFighter(defaultCharacter());
    for (const won of [false, true, true, false]) rules.recordLadder(a.id, { opponentId: 'bernd-brummer', won }, a.editToken);
    rules.compact(100, 2);
    expect(data.ladder?.length).toBe(1);
    expect(rules.ladderBeaten(a.id)).toEqual(['bernd-brummer']);
  });

  it('hashes old opponent ids with 32-bit FNV-1a', () => {
    expect(fnv1a('')).toBe('811c9dc5');
    expect(fnv1a('a')).toBe('e40c292c');
  });

  it('keeps current and unknown opponent ids when migrating', () => {
    const old = emptyGameData();
    old.ladder = [
      { fighterId: 'a', opponentId: 'bernd-brummer', won: true, playedAt: '' },
      { fighterId: 'a', opponentId: 'nobody', won: true, playedAt: '' },
    ];
    expect(migrateOpponentIds(old)).toBeFalse();
    expect(old.ladder.map((r) => r.opponentId)).toEqual(['bernd-brummer', 'nobody']);
  });
});
