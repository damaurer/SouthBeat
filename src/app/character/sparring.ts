import { Character } from './character.model';
import { defaultCharacter } from './balance';

/** Stand-in opponent until multiplayer matchmaking exists. */
export const SPARRING_PARTNER: Character = {
  name: 'Sparringspartner',
  appearance: {
    ...defaultCharacter().appearance,
    skinColor: '#c68642',
    hairColor: '#1c1c1c',
    hairStyle: 'afro',
    beardStyle: 'goatee',
    outfitStyle: 'hoodie',
    outfitColor: '#2b2f3a',
  },
  moves: { light: 'mouse-flick', heavy: 'monitor-slam', kick: 'cable-sweep', special: 'stack-overflow', ultimate: 'blue-screen' },
  stats: { strength: 6, speed: 6, defense: 5, stamina: 5 },
};
