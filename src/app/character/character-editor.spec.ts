import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CharacterEditor } from './character-editor';
import { STAT_BUDGET } from './balance';

describe('CharacterEditor', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [CharacterEditor],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
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

  it('saves a new fighter to the server and remembers its id', async () => {
    const fixture = TestBed.createComponent(CharacterEditor);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.save')!.click();

    const req = TestBed.inject(HttpTestingController).expectOne('/api/fighters');
    expect(req.request.method).toBe('POST');
    req.flush({ ...req.request.body, id: 'abc', createdAt: '', updatedAt: '' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(localStorage.getItem('southbeat.fighterId')).toBe('abc');
    expect((fixture.nativeElement as HTMLElement).querySelector('.saved')).not.toBeNull();
  });

  it('renders the sprite preview', () => {
    const fixture = TestBed.createComponent(CharacterEditor);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-sprite-preview rect').length).toBeGreaterThan(100);
  });
});
