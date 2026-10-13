import { TestBed } from '@angular/core/testing';
import { KEYS } from './controls';
import { KeyBindings, labelFor } from './key-bindings';

describe('KeyBindings', () => {
  beforeEach(() => localStorage.removeItem('southbeat.keys'));
  afterEach(() => localStorage.removeItem('southbeat.keys'));

  const fresh = (): KeyBindings => TestBed.runInInjectionContext(() => new KeyBindings());

  it('starts with the default keys', () => {
    expect(fresh().keys()).toEqual(KEYS);
  });

  it('rebinds a key and keeps it on this PC', () => {
    const b = fresh();
    b.bind(0, 'light', 'KeyU', 'U');
    expect(b.keys()[0].light).toBe('KeyU');
    expect(b.isGameKey('KeyU')).toBeTrue();
    expect(b.isGameKey('KeyJ')).toBeFalse();
    const again = fresh();
    expect(again.keys()[0].light).toBe('KeyU');
    expect(again.name('KeyU')).toBe('U');
  });

  it('swaps when the key is already taken, also across players', () => {
    const b = fresh();
    const result = b.bind(0, 'light', KEYS[1].left, '←');
    expect(result.swappedWith).toEqual({ player: 1, action: 'left' });
    expect(b.keys()[0].light).toBe(KEYS[1].left);
    expect(b.keys()[1].left).toBe(KEYS[0].light);
  });

  it('resets one player to the defaults', () => {
    const b = fresh();
    b.bind(1, 'ultimate', 'Enter', 'Enter');
    b.reset(1);
    expect(b.keys()[1]).toEqual(KEYS[1]);
  });

  it('labels keys the way the keyboard shows them', () => {
    expect(labelFor({ key: 'z', code: 'KeyY' })).toBe('Z');
    expect(labelFor({ key: ' ', code: 'Space' })).toBe('Leertaste');
    expect(labelFor({ key: 'ArrowUp', code: 'ArrowUp' })).toBe('↑');
  });
});
