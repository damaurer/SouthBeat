import { ART_PRESETS, emptyArt, isValidArt, paintArtCell } from './projectile-art';
import { characterErrors, defaultCharacter } from './balance';

describe('projectile art', () => {
  it('has valid presets', () => {
    for (const p of Object.values(ART_PRESETS)) expect(isValidArt(p.art)).withContext(p.label).toBeTrue();
  });

  it('paints a single cell without touching the original', () => {
    const art = emptyArt();
    const next = paintArtCell(art, 3, 2, 'a');
    expect(next[2][3]).toBe('a');
    expect(art[2][3]).toBe('.');
    expect(paintArtCell(next, 3, 2, 'a')).toBe(next);
    expect(paintArtCell(next, 20, 2, 'a')).toBe(next);
  });

  it('rejects broken drawings on a character', () => {
    const c = defaultCharacter();
    expect(characterErrors(c)).toEqual([]);
    expect(characterErrors({ ...c, projectileArt: ['zzz'] })).toContain('Ungültige Geschoss-Zeichnung.');
    expect(characterErrors({ ...c, projectileArt: emptyArt().map((r) => r.replace('.', 'x')) }).length).toBe(1);
  });
});
