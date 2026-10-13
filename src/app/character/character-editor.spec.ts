import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CharacterEditor } from './character-editor';
import { STAT_BUDGET } from './balance';

describe('CharacterEditor', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [CharacterEditor],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('disables + buttons once the point budget is spent', () => {
    const fixture = TestBed.createComponent(CharacterEditor);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const plus = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.stat button:last-of-type'));

    for (let i = 0; i < STAT_BUDGET; i++) {
      plus()[0].click();
      fixture.detectChanges();
    }

    expect(el.querySelector('.budget')?.textContent).toContain('0 Punkte');
    expect(plus().every((b) => b.disabled)).toBeTrue();
  });

  it('renders the sprite preview', () => {
    const fixture = TestBed.createComponent(CharacterEditor);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-sprite-preview rect').length).toBeGreaterThan(100);
  });
});
