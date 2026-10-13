import { MoveSlot } from '../character/character.model';

/** What any fighter may say after taking a hit. Purely cosmetic. */
export const HIT_LINES: readonly string[] = [
  'Autsch!',
  'Das gibt ein Ticket!',
  'Das war nicht im Scope!',
  'Hey, ich bin im Fokus-Modus!',
  'Das fix ich später.',
  'Works on my machine!',
  'Nicht ins Gesicht, da ist die Brille!',
  'Das geht an die Retro!',
  'Ich hab doch Rufbereitschaft!',
  'Mein Kaffee!',
  'Segfault!',
  'Null Pointer im Bauch!',
  'Das melde ich der HR!',
  'Strg+Z! Strg+Z!',
  'Wer hat das deployt?',
  'Das war ein Breaking Change!',
  'Ich brauch erst mal einen Rollback.',
  'Merge-Konflikt im Rücken!',
];

/** Chance that a hit makes the fighter say something, by the attack that landed. */
const CHANCE: Record<MoveSlot, number> = { light: 0.25, heavy: 0.45, kick: 0.35, special: 0.5, ultimate: 1 };

/** Minimum frames between two hit lines of the same fighter, so it stays "now and then". */
export const HIT_LINE_COOLDOWN = 150;

export function saysSomething(slot: MoveSlot, random: () => number): boolean {
  return random() < CHANCE[slot];
}

/** Draws lines in a shuffled order so nobody repeats themselves before running out. */
export class LineDeck {
  private unsaid: string[] = [];

  constructor(private readonly lines: readonly string[]) {}

  draw(random: () => number): string {
    if (this.unsaid.length === 0) this.unsaid = [...this.lines];
    return this.unsaid.splice(Math.floor(random() * this.unsaid.length), 1)[0];
  }
}
