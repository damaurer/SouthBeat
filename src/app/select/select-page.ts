import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CharacterStore } from '../character/character-store';
import { seeded } from '../arena/painter';
import { CharacterSelect, FighterPicks } from './character-select';
import { resolvePick } from './roster';

/** Free fight, step 1: pick the fighters, then go on to the arena select. */
@Component({
  selector: 'app-select-page',
  imports: [CharacterSelect],
  template: `<app-character-select [initial]="initial" (confirmed)="next($event)" (back)="home()" />`,
})
export class SelectPage {
  private readonly router = inject(Router);
  private readonly store = inject(CharacterStore);
  protected readonly initial = picksFromQuery(inject(ActivatedRoute).snapshot.queryParamMap);

  protected next(picks: FighterPicks): void {
    // Random picks are settled here, so the arena preview already shows who fights.
    const entries = this.store.roster();
    const random = seeded(Date.now());
    const p1 = resolvePick(picks.p1, entries, random).id;
    const p2 = resolvePick(picks.p2 ?? 'sparring', entries, random).id;
    void this.router.navigate(['/arena'], { queryParams: { p1, p2, mode: picks.mode } });
  }

  protected home(): void {
    void this.router.navigate(['/']);
  }
}

export function picksFromQuery(q: { get(name: string): string | null }): FighterPicks | null {
  const p1 = q.get('p1');
  if (!p1) return null;
  return { p1, p2: q.get('p2'), mode: q.get('mode') === 'local' ? 'local' : 'cpu' };
}
