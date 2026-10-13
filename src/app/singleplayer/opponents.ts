import { Character } from '../character/character.model';
import { defaultCharacter } from '../character/balance';
import { CpuProfile } from '../fight/combat';

/**
 * The single-player ladder, in the order it is played. Opponents are not
 * bound by the player's point budget, so later ones are tougher.
 */
export interface Opponent {
  id: string;
  title: string;
  /** What the ladder shows about the opponent's fighting style. */
  blurb: string;
  arenaId: string;
  character: Character;
  cpu: CpuProfile;
  /** Speech bubbles shown at the top of the screen. Purely cosmetic. */
  lines: string[];
  /** Average seconds between two speech bubbles. */
  chattiness: number;
  boss?: boolean;
}

const look = defaultCharacter().appearance;

export const OPPONENTS: readonly Opponent[] = [
  {
    id: 'bernd-brummer',
    title: 'Co-Teamleiter',
    blurb: 'Kräftig gebaut, mit Bart und Brille. Schubst dich mit seinem Bauch quer durchs Büro.',
    arenaId: 'kitchen',
    character: {
      name: 'Bernd',
      appearance: { ...look, bodyType: 'heavy', accessory: 'glasses', beardStyle: 'full', hairStyle: 'short', hairColor: '#5a3d1e', outfitStyle: 'casual', outfitColor: '#5d6d7e' },
      moves: { light: 'keyboard-jab', heavy: 'monitor-slam', kick: 'chair-spin', special: 'belly-bump', ultimate: 'friday-deploy' },
      stats: { strength: 7, speed: 3, defense: 7, stamina: 7 },
    },
    cpu: { aggression: 0.06, specialChance: 0.05 },
    lines: ['Platz da, hier kommt der Co-Teamleiter!', 'Erst mal einen Kaffee.', 'Das klären wir im Team.', 'Bauch schlägt Kopf!', 'Hast du das Ticket schon geschätzt?'],
    chattiness: 9,
  },
  {
    id: 'konrad-kettner',
    title: 'Teamleiter',
    blurb: 'Der Panzer-General. Mit seiner Spezialattacke rollt ein Panzer über dich hinweg.',
    arenaId: 'bunker',
    character: {
      name: 'Konrad',
      appearance: { ...look, accessory: 'cap', beardStyle: 'mustache', hairStyle: 'short', hairColor: '#7a7a7a', outfitStyle: 'uniform', outfitColor: '#4b5320' },
      moves: { light: 'mouse-flick', heavy: 'laptop-uppercut', kick: 'chair-spin', special: 'tank-roll', ultimate: 'rm-rf' },
      stats: { strength: 8, speed: 4, defense: 7, stamina: 7 },
    },
    cpu: { aggression: 0.07, specialChance: 0.012 },
    lines: ['Antreten zum Daily!', 'Panzer, marsch!', 'Das ist ein Befehl, kein Vorschlag.', 'Sprint-Ziel: dich besiegen.', 'Rührt euch!'],
    chattiness: 8,
  },
  {
    id: 'lena-flink',
    title: 'HO',
    blurb: 'Blitzschnell. Glänzt mit schnellen Angriffen und Kombos, die kaum Pausen lassen.',
    arenaId: 'meeting-room',
    character: {
      name: 'Lena',
      appearance: { ...look, bodyType: 'slim', hairStyle: 'ponytail', hairColor: '#a33a1c', skinColor: '#f1c27d', eyeColor: '#2e8b57', outfitStyle: 'blouse', outfitColor: '#8e44ad' },
      moves: { light: 'combo-flurry', heavy: 'combo-chain', kick: 'cable-sweep', special: 'stack-overflow', ultimate: 'infinite-loop' },
      stats: { strength: 5, speed: 10, defense: 4, stamina: 6 },
    },
    cpu: { aggression: 0.16, specialChance: 0.01 },
    lines: ['Zu langsam!', 'Kombo incoming!', 'Das Meeting ist vorbei, bevor es anfängt.', 'Eins, zwei, drei, vier!', 'Ich hab noch drei Termine danach.'],
    chattiness: 9,
  },
  {
    id: 'ralf-rackwitz',
    title: 'CTO',
    blurb: 'Schlägt mit Server-Bauteilen zu und wirft hin und wieder eine Festplatte nach dir.',
    arenaId: 'server-room',
    character: {
      name: 'Ralf',
      appearance: { ...look, accessory: 'headset', beardStyle: 'stubble', hairStyle: 'spiky', hairColor: '#111111', outfitStyle: 'hoodie', outfitColor: '#1f3a5f' },
      moves: { light: 'keyboard-jab', heavy: 'rack-slam', kick: 'cable-sweep', special: 'hdd-throw', ultimate: 'blue-screen' },
      stats: { strength: 8, speed: 6, defense: 7, stamina: 8 },
    },
    cpu: { aggression: 0.1, specialChance: 0.02 },
    lines: ['Das Rack ist noch warm.', 'Wer hat das Kabel gezogen?', 'Have you tried turning it off and on again?', 'Achtung, RAID-Rebuild!', 'Die Architektur ist meine Entscheidung.'],
    chattiness: 8,
  },
  {
    id: 'gustav-grossmaul',
    title: 'CPO · Endboss',
    blurb: 'Der Endboss. Wirft mit Tomaten und redet ununterbrochen.',
    arenaId: 'rooftop',
    boss: true,
    character: {
      name: 'Gustav Großmaul',
      appearance: { ...look, accessory: 'sunglasses', hairStyle: 'short', hairColor: '#d4b13a', beardStyle: 'none', outfitStyle: 'suit', outfitColor: '#7a1f2b' },
      moves: { light: 'mouse-flick', heavy: 'monitor-slam', kick: 'chair-spin', special: 'tomato-throw', ultimate: 'tomato-rain' },
      stats: { strength: 8, speed: 7, defense: 7, stamina: 10 },
    },
    cpu: { aggression: 0.11, specialChance: 0.03 },
    lines: [
      'Lass uns das kurz offline besprechen.',
      'Ich hab da noch eine kleine Idee …',
      'Das ist kein Bug, das ist eine User Story!',
      'Können wir das bis Freitag shippen?',
      'Der Kunde wünscht sich das in Blau.',
      'Kurzer Sync? Dauert nur zwei Stunden.',
      'Hat jemand die Roadmap gesehen?',
      'Tomaten sind auch nur Feedback.',
      'Wir müssen größer denken!',
      'Ich will ja nicht reinreden, aber …',
      'Das Feature war doch ganz einfach!',
      'Lass uns mal den User in den Mittelpunkt stellen.',
    ],
    chattiness: 3,
  },
];

export function findOpponent(id: string | null): Opponent | undefined {
  return OPPONENTS.find((o) => o.id === id);
}
