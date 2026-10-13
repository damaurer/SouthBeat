import { ARENAS, findArena, paintArena } from './arenas';
import { ARENA_HEIGHT, ARENA_WIDTH } from './props';

describe('arenas', () => {
  it('includes the bunker and the rooftop office', () => {
    const ids = ARENAS.map((a) => a.id);
    expect(ids).toContain('bunker');
    expect(ids).toContain('rooftop');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('paints every arena as a full, valid image', () => {
    for (const arena of ARENAS) {
      const p = paintArena(arena);
      expect(p.pixels.length).toBe(ARENA_WIDTH * ARENA_HEIGHT);
      expect(p.pixels.every((c) => /^#[0-9a-f]{6}$/.test(c))).withContext(arena.id).toBeTrue();
      expect(new Set(p.pixels).size).withContext(arena.id).toBeGreaterThan(15);
    }
  });

  it('paints the same arena identically every time', () => {
    expect(paintArena(ARENAS[1]).pixels).toEqual(paintArena(ARENAS[1]).pixels);
  });

  it('falls back to the first arena for unknown ids', () => {
    expect(findArena('nope')).toBe(ARENAS[0]);
  });
});
