import { BEARD_STYLES, HAIR_STYLES, OUTFIT_STYLES } from './character.model';
import { defaultCharacter } from './balance';
import { SPRITE_HEIGHT, SPRITE_WIDTH, spritePixels } from './sprite';

describe('spritePixels', () => {
  it('renders every hair, beard and outfit combination inside the sprite bounds', () => {
    const base = defaultCharacter().appearance;
    for (const outfitStyle of OUTFIT_STYLES) {
      for (const hairStyle of HAIR_STYLES) {
        for (const beardStyle of BEARD_STYLES) {
          const pixels = spritePixels({ ...base, outfitStyle, hairStyle, beardStyle });
          expect(pixels.length).toBeGreaterThan(500);
          expect(pixels.every((p) => p.x >= 0 && p.y >= 0 && p.x < SPRITE_WIDTH && p.y < SPRITE_HEIGHT)).toBeTrue();
          expect(pixels.every((p) => /^#[0-9a-f]{6}$/.test(p.fill))).toBeTrue();
        }
      }
    }
  });

  it('draws a beard in the hair color', () => {
    const look = { ...defaultCharacter().appearance, hairStyle: 'bald' as const, hairColor: '#123456' };
    const count = (beardStyle: typeof look.beardStyle) =>
      spritePixels({ ...look, beardStyle }).filter((p) => p.y > 11 && p.y < 18 && p.x > 10 && p.x < 21).map((p) => p.fill).join();
    expect(count('full')).not.toEqual(count('none'));
  });
});
