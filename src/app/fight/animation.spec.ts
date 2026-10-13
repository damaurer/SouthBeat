import { defaultCharacter } from '../character/balance';
import { findMove } from '../character/character.model';
import { SPARRING_PARTNER } from '../character/sparring';
import { Animated, poseFor } from './animate';
import { HITSTOP, NO_INPUT, createFight, step } from './combat';
import { posedSprite } from './pose';

describe('fight animation', () => {
  const look = defaultCharacter().appearance;
  const idle: Animated = { action: null, hitstun: 0, knockedDown: false, downFrames: 0, walkFrames: 0, hp: 100 };
  const extent = (a: Animated) => {
    const px = posedSprite(look, poseFor(a, 0));
    const xs = px.map((p) => p.x);
    const ys = px.map((p) => p.y);
    return { right: Math.max(...xs), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), bottom: Math.max(...ys) };
  };

  it('stretches the arm out when a punch lands', () => {
    const jab = findMove('keyboard-jab')!;
    const punch = extent({ ...idle, action: { slot: 'light', move: jab, frame: 8, startup: 4, active: 8, total: 20 } });
    expect(punch.right).toBeGreaterThan(extent(idle).right + 6);
  });

  it('draws the fighter from the side, looking to the right', () => {
    const px = posedSprite(look, poseFor(idle, 0));
    const face = px.filter((p) => p.y >= 9 && p.y <= 11).map((p) => p.x);
    // The nose sticks out on the right, well past the middle of the 32 px sprite box.
    expect(Math.max(...face) - 16).toBeGreaterThanOrEqual(6);
    expect(16 - Math.min(...face)).toBeLessThan(6);
    expect(extent(idle).width).toBeLessThan(26);
  });

  it('lies flat on the floor after a knockdown', () => {
    const lying = extent({ ...idle, knockedDown: true, hitstun: 40, downFrames: 30 });
    const standing = extent(idle);
    expect(lying.width).toBeGreaterThan(lying.height);
    expect(Math.abs(lying.bottom - standing.bottom)).toBeLessThanOrEqual(1);
  });

  it('crouches lower than it stands, feet still on the floor', () => {
    const crouch = extent({ ...idle, crouching: true });
    expect(crouch.height).toBeLessThan(extent(idle).height - 6);
    expect(Math.abs(crouch.bottom - extent(idle).bottom)).toBeLessThanOrEqual(1);
  });

  it('freezes the fight for a moment after a hit, keeping buttons pressed meanwhile', () => {
    const s = createFight(defaultCharacter(), SPARRING_PARTNER, 'bunker');
    s.fighters[0].x = 110;
    s.fighters[1].x = 130;
    step(s, [{ ...NO_INPUT, light: true }, NO_INPUT]);
    let frames = 0;
    while (s.hitstop === 0 && frames++ < 40) step(s, [NO_INPUT, NO_INPUT]);
    expect(s.hitstop).toBe(HITSTOP.light);
    const frozen = JSON.stringify(s.fighters);
    step(s, [{ ...NO_INPUT, kick: true }, NO_INPUT]);
    expect(JSON.stringify(s.fighters.map((f) => ({ ...f, buffered: null })))).toBe(JSON.stringify(JSON.parse(frozen).map((f: object) => ({ ...f, buffered: null }))));
    expect(s.fighters[0].buffered?.slot).toBe('kick');
  });
});
