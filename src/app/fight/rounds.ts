import { FightState } from './combat';

/** The big call across the screen between and around rounds, or null while fighting. */
export function roundBanner(s: FightState): string | null {
  if (s.winner !== null) return null;
  if (s.intro > 0) {
    if (s.intro <= s.rules.introFrames * 0.35) return 'FIGHT!';
    const need = s.rules.roundsToWin;
    return s.rules.roundsToWin > 1 && s.wins[0] === need - 1 && s.wins[1] === need - 1 ? 'Finale Runde' : `Runde ${s.round}`;
  }
  if (s.roundWinner === null) return null;
  if (s.ko > s.rules.koFrames * 0.45) {
    const knockedOut = s.fighters.some((f) => f.hp <= 0);
    return knockedOut ? 'K.O.!' : 'Zeit!';
  }
  if (s.roundWinner === 'draw') return 'Unentschieden';
  return `${s.fighters[s.roundWinner].character.name} holt die Runde`;
}
