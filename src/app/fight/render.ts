import { Painter, shade } from '../arena/painter';
import { GROUND_Y } from '../arena/props';
import { SPRITE_HEIGHT, SPRITE_WIDTH, Pixel, spritePixels } from '../character/sprite';
import { FightState, FighterState, isActive, projectileLift, projectileX, reachOf } from './combat';
import { Appearance, usesCustomArt } from '../character/character.model';
import { ART_PALETTE, ART_SIZE, DEFAULT_ART } from '../character/projectile-art';
import { Outcome, poseFor } from './animate';
import { Effects } from './effects';
import { posedSprite } from './pose';
import { drawTomato, drawUltimate } from './ultimates';

export { drawTomato };

export { drawSpark } from './effects';
export type { Spark } from './effects';

const CHEST_Y = GROUND_Y - 30;
const KNEE_Y = GROUND_Y - 14;

const SPECIAL_COLORS: Record<string, [string, string]> = {
  'coffee-throw': ['#6f3b1a', '#f5deb3'],
  'merge-conflict': ['#e74c3c', '#2ecc71'],
  'stack-overflow': ['#f48024', '#ffffff'],
  reboot: ['#2a6fdb', '#ffffff'],
  headhunt: ['#0a66c2', '#ffffff'],
};


/** Caches sprite pixels per look so they are not rebuilt every frame. */
const spriteCache = new WeakMap<object, Pixel[]>();

export function cachedSprite(look: Appearance): Pixel[] {
  let pixels = spriteCache.get(look);
  if (!pixels) {
    pixels = spritePixels(look);
    spriteCache.set(look, pixels);
  }
  return pixels;
}

export function renderFight(arena: Painter, state: FightState, fx: Effects): Painter {
  const p = arena.clone();
  state.fighters.forEach((f) => drawShadow(p, Math.round(f.x), GROUND_Y, 9 - Math.min(4, Math.round(f.y / 10))));
  state.fighters.forEach((f, i) => drawFighter(p, f, state.frame, outcomeOf(state, i)));
  state.fighters.forEach((f) => drawAttack(p, f, state.frame));
  fx.draw(p);
  return fx.shaken(p);
}

/**
 * Feeds one fight frame into the effects: sparks and debris for hits and blocks, dust for
 * landings, knockdowns and running. Call once per game frame, after `step`.
 */
export function fightEffects(fx: Effects, state: FightState): void {
  for (const e of state.events) {
    if (e.type !== 'hit' && e.type !== 'block') continue;
    const attacker = state.fighters[e.attacker];
    const target = state.fighters[1 - e.attacker];
    const low = attacker.action?.level === 'low';
    const y = (low ? GROUND_Y - 12 : GROUND_Y - 30) - Math.round(target.y);
    const x = e.type === 'block' ? target.x + target.facing * 10 : target.x - attacker.facing * 4;
    fx.hit(x, y, attacker.facing, { big: e.slot === 'ultimate', heavy: e.slot === 'heavy' || e.slot === 'kick' || e.slot === 'special', blocked: e.type === 'block' });
  }
  state.fighters.forEach((f, i) => fx.watch(i, f.x, GROUND_Y, f));
  fx.step();
}

function outcomeOf(state: FightState, i: number): Outcome {
  // A won round already gets the victory pose while its KO plays out.
  const w = state.winner ?? (state.ko < state.rules.koFrames * 0.45 ? state.roundWinner : null);
  if (w === null || w === 'draw') return null;
  return w === i ? 'won' : 'lost';
}

/** A soft dark patch on the floor under a fighter. */
export function drawShadow(p: Painter, x: number, ground: number, half: number): void {
  for (let dy = -1; dy <= 0; dy++) {
    const w = dy === 0 ? half : half - 2;
    for (let dx = -w; dx < w; dx++) {
      const px = x + dx;
      const py = ground + dy;
      if (px >= 0 && px < p.width && py >= 0 && py < p.height) p.set(px, py, shade(p.get(px, py), -0.4));
    }
  }
}

function drawFighter(p: Painter, f: FighterState, frame: number, outcome: Outcome): void {
  const a = f.action;
  if (a?.slot === 'ultimate' && a.frame <= a.startup) {
    // Charging aura around the fighter.
    const color = frame % 4 < 2 ? '#ffe66d' : '#ffffff';
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2 + frame * 0.2;
      p.set(f.x + Math.cos(angle) * 20, GROUND_Y - 24 + Math.sin(angle) * 28, color);
    }
  }
  const flash = f.hitstun > 0 && !f.knockedDown && f.hitstun % 6 < 2;
  let pixels = posedSprite(f.character.appearance, poseFor(f, frame, outcome));
  if (flash) pixels = pixels.map((px) => ({ ...px, fill: '#ffffff' }));
  const left = Math.round(f.x) - SPRITE_WIDTH / 2;
  const top = GROUND_Y - SPRITE_HEIGHT - Math.round(f.y);
  p.sprite(left, top, pixels, SPRITE_WIDTH, f.facing === -1);
}

/** Crouching lowers attacks by this many pixels. */
const CROUCH_DROP = 9;

function drawAttack(p: Painter, f: FighterState, frame: number): void {
  const a = f.action;
  // The ultimate's beam stays on screen longer than its hitbox so it can be seen.
  const showBeam = a?.slot === 'ultimate' && a.frame > a.startup && a.frame <= a.startup + Math.max(18, a.active);
  if (!a || !(isActive(f) || showBeam)) return;
  const front = f.x + f.facing * 12;
  const reach = reachOf(a.move);
  const fresh = a.frame - a.startup <= 4;
  // Jumping fighters attack from higher up, crouching ones from lower down.
  const lift = -Math.round(f.y) + (a.stance === 'crouch' ? CROUCH_DROP : 0);
  const box = (dx: number, y: number, w: number, h: number, color: string): void => {
    const x0 = f.facing === 1 ? front + dx : front - dx - w;
    p.rect(Math.round(x0), y + lift, w, h, color);
  };
  if (a.stance === 'crouch' && a.slot === 'kick') {
    // Sweep along the floor.
    box(reach - 24, GROUND_Y - 4 - lift, 12, 3, '#f2f2f2');
    box(reach - 36, GROUND_Y - 3 - lift, 11, 1, '#9aa5b1');
    return;
  }
  if (a.stance === 'crouch' && a.slot === 'heavy') {
    // Rising anti-air uppercut.
    box(reach - 26, CHEST_Y - 22, 6, 14, '#ffe66d');
    box(reach - 25, CHEST_Y - 6, 4, 8, '#ffffff');
    return;
  }
  if (a.stance === 'air' && a.slot !== 'light') {
    // Jump attacks aim down at the opponent.
    for (let i = 0; i < 4; i++) box(reach - 26 + i * 2, KNEE_Y - 4 + i * 3, 5, 3, a.slot === 'heavy' ? '#ffe66d' : '#f2f2f2');
    return;
  }

  const thrown = projectileX(f);
  if (thrown !== null) {
    // A projectile disappears once it has hit.
    if (a.hitsLanded >= (a.move.hits ?? 1)) return;
    const y = CHEST_Y - Math.round(projectileLift(f));
    if (usesCustomArt(a.move)) drawArt(p, f.character.projectileArt ?? DEFAULT_ART, thrown, y, f.facing, frame);
    else drawProjectile(p, a.move.id, thrown, f.facing, frame);
    return;
  }
  if (a.move.dashSpeed) {
    for (let i = 0; i < 4; i++) box(-30 - (i % 2) * 4, CHEST_Y - 8 + i * 6, 10 + (i % 2) * 6, 1, '#ffffff');
    return;
  }

  switch (a.move.id) {
    case 'belly-bump':
      box(-4, CHEST_Y + 4, 6, 10, '#f2f2f2');
      for (let i = 0; i < 3; i++) box(4 + i * 5, CHEST_Y + 2 + i * 4, 4, 1, '#ffffff');
      return;
    case 'combo-flurry':
    case 'combo-chain': {
      const n = Math.floor((a.frame - a.startup - 1) / 4);
      const ys = [CHEST_Y - 4, CHEST_Y + 2, CHEST_Y - 1, KNEE_Y];
      box(reach - 18 - (n % 2) * 3, ys[n % ys.length], 5, 4, '#f2f2f2');
      box(reach - 26, ys[n % ys.length] + 1, 7, 1, '#ff8fb1');
      return;
    }
    case 'rack-slam':
      box(reach - 24, CHEST_Y - 10, 8, 18, '#1a1d24');
      box(reach - 23, CHEST_Y - 9, 6, 1, '#39ff88');
      box(reach - 23, CHEST_Y - 5, 6, 1, '#39ff88');
      box(reach - 23, CHEST_Y - 1, 6, 1, '#ff5a5a');
      return;
  }

  switch (a.slot) {
    // Normal attacks show the swing itself; short speed lines trail the fist or foot.
    case 'light':
      if (fresh) box(reach - 30, CHEST_Y + 1, 8, 1, '#ffffff');
      return;
    case 'heavy':
      if (fresh) {
        box(reach - 36, CHEST_Y - 1, 12, 1, '#ffffff');
        box(reach - 34, CHEST_Y + 2, 9, 1, '#ffe66d');
      }
      return;
    case 'kick':
      if (fresh) {
        box(reach - 34, KNEE_Y - 2, 10, 1, '#ffffff');
        box(reach - 32, KNEE_Y + 1, 7, 1, '#9aa5b1');
      }
      return;
    case 'special': {
      const [c1, c2] = SPECIAL_COLORS[a.move.id] ?? ['#ffffff', '#cccccc'];
      const dx = (reach - 16) * Math.min(1, (a.frame - a.startup) / a.active);
      box(dx, CHEST_Y - 3, 6, 6, c1);
      box(dx + 1, CHEST_Y - 2, 2, 2, c2);
      box(dx - 6, CHEST_Y, 5, 1, c2);
      return;
    }
    case 'ultimate':
      drawUltimate(p, a.move.id, { front, facing: f.facing, reach, chest: CHEST_Y + lift, ground: GROUND_Y, frame });
      return;
  }
}

/** Draws the player's own projectile drawing, centered on (x, y) and facing the throw direction. */
export function drawArt(p: Painter, art: string[], x: number, y: number, facing: 1 | -1, frame: number): void {
  const left = Math.round(x) - ART_SIZE / 2;
  const top = y - ART_SIZE / 2 + (frame % 8 < 4 ? 0 : 1);
  art.forEach((row, ay) => {
    for (let ax = 0; ax < ART_SIZE; ax++) {
      const color = ART_PALETTE[row[ax]];
      if (color) p.set(left + (facing === 1 ? ax : ART_SIZE - 1 - ax), top + ay, color);
    }
  });
}


export function drawProjectile(p: Painter, id: string, x: number, facing: 1 | -1, frame: number, ground = GROUND_Y): void {
  const px = Math.round(x);
  const chest = ground - 30;
  switch (id) {
    case 'tomato-throw':
      drawTomato(p, px, chest - 2 + Math.round(Math.sin(frame * 0.4) * 2));
      return;
    case 'hdd-throw': {
      const spin = frame % 8 < 4;
      const w = spin ? 12 : 8;
      const h = spin ? 8 : 11;
      p.rect(px - w / 2 - 1, chest - h / 2 - 1, w + 2, h + 2, '#140c1c');
      p.rect(px - w / 2, chest - h / 2, w, h, '#9aa5b1');
      p.rect(px - 2, chest - 2, 4, 4, '#5a6470');
      p.set(px + w / 2 - 2, chest + h / 2 - 2, '#39ff88');
      return;
    }
    case 'tank-roll':
      drawTank(p, px, facing, frame, ground);
      return;
    case 'ticket-spam':
      // A yellow sticky ticket with a few lines of text.
      p.rect(px - 4, chest - 4, 8, 8, '#f7d84a');
      p.hline(px - 3, chest - 2, 6, '#8a6d00');
      p.hline(px - 3, chest, 4, '#8a6d00');
      p.set(px + 3, chest + 3, '#e74c3c');
      return;
    case 'bug-report': {
      // A beetle crawling along the floor.
      const y = ground - 3;
      const leg = frame % 6 < 3 ? 0 : 1;
      p.rect(px - 4, y - 2, 8, 4, '#2d7a2d');
      p.rect(px + facing * 4 - 1, y - 1, 2, 2, '#140c1c');
      for (const lx of [-3, 0, 3]) {
        p.set(px + lx, y - 3 + leg, '#140c1c');
        p.set(px + lx, y + 2 - leg, '#140c1c');
      }
      p.set(px - facing * 2, y - 1, '#e74c3c');
      return;
    }
    case 'card-throw':
      p.rect(px - 3, chest - 2, 7, 4, '#ffffff');
      p.hline(px - 2, chest - 1, 3, '#0a66c2');
      return;
    case 'bucket-lob':
      p.rect(px - 4, chest - 4, 8, 7, '#2a6fdb');
      p.hline(px - 4, chest - 4, 8, '#9fc3e6');
      p.rect(px - 3, chest - 6, 6, 1, '#7f8c8d');
      return;
    case 'coffee-throw':
      p.rect(px - 2, chest - 3, 5, 6, '#f2f2f2');
      p.rect(px - 1, chest - 3, 3, 1, '#6f3b1a');
      p.rect(px - 2 - facing * 4, chest - 1, 3, 1, '#6f3b1a');
      return;
    default: {
      const [c1, c2] = SPECIAL_COLORS[id] ?? ['#ffffff', '#cccccc'];
      p.rect(px - 3, chest - 3, 6, 6, c1);
      p.rect(px - 2, chest - 2, 2, 2, c2);
    }
  }
}

/** A small tank that rolls along the floor. */
function drawTank(p: Painter, x: number, facing: 1 | -1, frame: number, ground: number): void {
  const hull = '#4b5320';
  const dark = '#2f3514';
  const g = ground;
  p.rect(x - 16, g - 8, 32, 8, '#1c1c1c');
  for (let i = 0; i < 6; i++) p.rect(x - 14 + i * 5 + (frame % 2), g - 6, 3, 4, '#555555');
  p.rect(x - 15, g - 16, 30, 8, hull);
  p.hline(x - 15, g - 16, 30, '#6b7a2e');
  p.rect(x - 8, g - 22, 14, 6, dark);
  p.rect(facing === 1 ? x + 6 : x - 22, g - 20, 16, 2, dark);
  p.rect(x - 4, g - 13, 4, 3, '#e8c547');
}
