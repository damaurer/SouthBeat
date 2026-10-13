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
  /** What they say now and then after taking a hit. */
  hitLines: string[];
  /** Average seconds between two speech bubbles. */
  chattiness: number;
  boss?: boolean;
}

const look = defaultCharacter().appearance;

export const OPPONENTS: readonly Opponent[] = [
  {
    id: 'bernd-brummer',
    title: 'Bernd · Co-Teamleiter',
    blurb: 'Kräftig gebaut, mit Bart und Brille. Schubst dich mit seinem Bauch quer durchs Büro.',
    arenaId: 'kitchen',
    character: {
      name: 'Bernd Brummer',
      appearance: { ...look, bodyType: 'heavy', accessory: 'glasses', beardStyle: 'full', hairStyle: 'short', hairColor: '#5a3d1e', outfitStyle: 'casual', outfitColor: '#5d6d7e' },
      moves: { light: 'keyboard-jab', heavy: 'monitor-slam', kick: 'chair-spin', special: 'belly-bump', ultimate: 'friday-deploy' },
      stats: { strength: 7, speed: 3, defense: 7, stamina: 7 },
    },
    cpu: { aggression: 0.06, specialChance: 0.05 },
    lines: [
      'Platz da, hier kommt der Co-Teamleiter!',
      'Erst mal einen Kaffee.',
      'Das klären wir im Team.',
      'Bauch schlägt Kopf!',
      'Hast du das Ticket schon geschätzt?',
      'Ich vertrete hier nur den Teamleiter. Mit Nachdruck.',
      'Wer hat den letzten Keks gegessen?',
      'Ich hab da mal was vorbereitet.',
      'Das schieben wir ins nächste Sprint.',
      'Mittagspause ist heilig!',
      'Brille putzen, weiter geht’s.',
      'Das war im Refinement aber anders besprochen.',
      'Ich drück dich mal kurz an die Wand.',
      'Kein Stress, ich hab Zeit. Und Masse.',
    ],
    hitLines: [
      'Uff, mein Bauch!',
      'Das war mein Mittagessen!',
      'Brille sitzt noch. Glück gehabt.',
      'Das bespreche ich mit dem Teamleiter!',
      'Hey, ich bin nur Co!',
      'Masse federt das ab.',
    ],
    chattiness: 9,
  },
  {
    id: 'konrad-kettner',
    title: 'Konrad · Teamleiter',
    blurb: 'Der Panzer-General. Mit seiner Spezialattacke rollt ein Panzer über dich hinweg.',
    arenaId: 'bunker',
    character: {
      name: 'Konrad Kettner',
      appearance: { ...look, accessory: 'cap', beardStyle: 'mustache', hairStyle: 'short', hairColor: '#7a7a7a', outfitStyle: 'uniform', outfitColor: '#4b5320' },
      moves: { light: 'mouse-flick', heavy: 'laptop-uppercut', kick: 'chair-spin', special: 'tank-roll', ultimate: 'rm-rf' },
      stats: { strength: 8, speed: 4, defense: 7, stamina: 7 },
    },
    cpu: { aggression: 0.07, specialChance: 0.012 },
    lines: [
      'Antreten zum Daily!',
      'Panzer, marsch!',
      'Das ist ein Befehl, kein Vorschlag.',
      'Sprint-Ziel: dich besiegen.',
      'Rührt euch!',
      'Im Bunker gibt es keine Ausreden.',
      'Stillgestanden! Code Review!',
      'Ich will Ergebnisse sehen, Soldat!',
      'Das Burndown-Chart zeigt nach unten. Gut so.',
      'Wer zu spät zum Standup kommt, schiebt Wache.',
      'Ketten frei für den nächsten Release!',
      'Rückzug ist keine Option.',
      'Die Retro findet heute im Schützengraben statt.',
      'Feuer frei auf alle offenen Bugs!',
    ],
    hitLines: [
      'Das ist Befehlsverweigerung!',
      'Sanitäter!',
      'Panzerung hält!',
      'Das gibt einen Eintrag ins Sprint-Protokoll!',
      'Nur ein Kratzer im Lack.',
      'Rückzug? Niemals!',
    ],
    chattiness: 8,
  },
  {
    id: 'lena-flink',
    title: 'Lena · HO',
    blurb: 'Blitzschnell. Glänzt mit schnellen Angriffen und Kombos, die kaum Pausen lassen.',
    arenaId: 'meeting-room',
    character: {
      name: 'Lena Flink',
      appearance: { ...look, bodyType: 'slim', hairStyle: 'ponytail', hairColor: '#a33a1c', skinColor: '#f1c27d', eyeColor: '#2e8b57', outfitStyle: 'blouse', outfitColor: '#8e44ad' },
      moves: { light: 'combo-flurry', heavy: 'combo-chain', kick: 'cable-sweep', special: 'stack-overflow', ultimate: 'infinite-loop' },
      stats: { strength: 5, speed: 10, defense: 4, stamina: 6 },
    },
    cpu: { aggression: 0.16, specialChance: 0.01 },
    lines: [
      'Zu langsam!',
      'Kombo incoming!',
      'Das Meeting ist vorbei, bevor es anfängt.',
      'Eins, zwei, drei, vier!',
      'Ich hab noch drei Termine danach.',
      'Schneller als jeder Hotfix!',
      'Blink, und du hast es verpasst.',
      'Mein Kalender ist voll, also mach schnell.',
      'Multitasking ist mein Kampfstil.',
      'Noch eine Runde? Gern, aber zügig.',
      'Das hab ich schon dreimal delegiert.',
      'Agil heißt bei mir: richtig schnell.',
      'Du blockst wie ein Legacy-System.',
      'Kurz und schmerzhaft, wie ein gutes Meeting.',
    ],
    hitLines: [
      'Hey, ich hab gleich einen Termin!',
      'Das war nicht abgesprochen!',
      'Zu schnell? Für mich doch nicht!',
      'Autsch, meine Frisur!',
      'Das trag ich mir in den Kalender ein.',
      'Kurze Pause, dann geht’s weiter!',
    ],
    chattiness: 9,
  },
  {
    id: 'ralf-rackwitz',
    title: 'Ralf · CTO',
    blurb: 'Schlägt mit Server-Bauteilen zu und wirft hin und wieder eine Festplatte nach dir.',
    arenaId: 'server-room',
    character: {
      name: 'Ralf Rackwitz',
      appearance: { ...look, accessory: 'headset', beardStyle: 'stubble', hairStyle: 'spiky', hairColor: '#111111', outfitStyle: 'hoodie', outfitColor: '#1f3a5f' },
      moves: { light: 'keyboard-jab', heavy: 'rack-slam', kick: 'cable-sweep', special: 'hdd-throw', ultimate: 'blue-screen' },
      stats: { strength: 8, speed: 6, defense: 7, stamina: 8 },
    },
    cpu: { aggression: 0.1, specialChance: 0.02 },
    lines: [
      'Das Rack ist noch warm.',
      'Wer hat das Kabel gezogen?',
      'Have you tried turning it off and on again?',
      'Achtung, RAID-Rebuild!',
      'Die Architektur ist meine Entscheidung.',
      'Fang! Ist nur eine alte Festplatte.',
      'Das skaliert nicht. Du auch nicht.',
      'Ich hab schon Mainframes verprügelt.',
      'Downtime ist keine Option.',
      'Hier kommt dein Hardware-Upgrade!',
      'Die Cloud ist auch nur ein fremder Server.',
      'Monitoring sagt: Du verlierst.',
      'Das migrieren wir am Wochenende.',
      'Mehr RAM hilft immer. Auch beim Zuschlagen.',
    ],
    hitLines: [
      'Kernel Panic!',
      'Mein Uptime-Rekord!',
      'Das war ein Hardwaredefekt.',
      'Ich starte mich kurz neu.',
      'Failover aktiviert!',
      'Das landet im Incident-Report!',
    ],
    chattiness: 8,
  },
  {
    id: 'gustav-grossmaul',
    title: 'Gustav · CSO · Endboss',
    blurb: 'Der Endboss. Ein alter Mann mit langem Bart, der mit Tomaten wirft, ununterbrochen redet und Kunden Dinge verspricht, die es noch gar nicht gibt.',
    arenaId: 'rooftop',
    boss: true,
    character: {
      name: 'Gustav Großmaul',
      appearance: { ...look, accessory: 'glasses', hairStyle: 'receding', hairColor: '#e6e6e6', beardStyle: 'long', skinColor: '#e8c4a0', eyeColor: '#5b7c99', outfitStyle: 'suit', outfitColor: '#7a1f2b' },
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
      'Hab dem Kunden schon zugesagt, dass das morgen live ist.',
      'Das Feature ist quasi fertig. Ich hab’s ja schon verkauft.',
      'Abgestimmt? Wieso, der Kunde hat doch schon unterschrieben.',
      'Klar können wir das. Ich hab’s dem Vorstand versprochen.',
      'Ich hab dem Kunden eine KI-Funktion versprochen. Welche, sag ich euch noch.',
      'Das Backend? Ach, das macht ihr schon irgendwie.',
      'Der Kunde kriegt das gratis dazu. Hab ich gestern beim Essen gesagt.',
      'Implementiert ist es nicht, aber auf der Folie sieht es super aus.',
      'Zu meiner Zeit haben wir noch mit Lochkarten gekämpft!',
      'Mein Bart ist älter als euer Tech-Stack.',
      'Diese Tomaten hab ich selbst gezogen. Bio!',
      'Ich hab da letzte Woche mal was angeteasert …',
      'Das Release-Datum steht. Den Umfang klären wir später.',
      'Ich hab gesagt, das dauert nur zwei Tage. Viel Glück!',
    ],
    hitLines: [
      'Ich hab dem Kunden versprochen, dass das nicht weh tut!',
      'Das ist kein Treffer, das ist ein Feature!',
      'Meine Tomaten!',
      'Zu meiner Zeit hat man noch Respekt vor dem Alter gehabt!',
      'Das klären wir im nächsten Steering!',
      'Mein Bart!',
      'Das hab ich so nie freigegeben!',
      'Der Kunde wird das lieben. Ich nicht.',
    ],
    chattiness: 3,
  },
];

export function findOpponent(id: string | null): Opponent | undefined {
  return OPPONENTS.find((o) => o.id === id);
}
