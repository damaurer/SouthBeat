import { Painter } from '../arena/painter';
import { GROUND_Y } from '../arena/props';
import { SPRITE_HEIGHT, SPRITE_WIDTH, Pixel, spritePixels } from '../character/sprite';
import { FightState, FighterState, isActive, projectileX, reachOf } from './combat';

export interface Spark {
  x: number;
  y: number;
  life: number;
  big: boolean;
}

const CHEST_Y = GROUND_Y - 30;
const KNEE_Y = GROUND_Y - 14;

const SPECIAL_COLORS: Record<string, [string, string]> = {
  'coffee-throw': ['#6f3b1a', '#f5deb3'],
  'merge-conflict': ['#e74c3c', '#2ecc71'],
  'stack-overflow': ['#f48024', '#ffffff'],
};

const ULTIMATE_COLORS: Record<string, [string, string]> = {
  'friday-deploy': ['#ff6b1a', '#ffe66d'],
  'rm-rf': ['#d62828', '#1a1a1a'],
  'blue-screen': ['#0a3dcc', '#ffffff'],
  'infinite-loop': ['#9b59ff', '#5ad1ff'],
};

/** Caches sprite pixels per fighter so they are not rebuilt every frame. */
const spriteCache = new WeakMap<object, Pixel[]>();
function pixelsFor(f: FighterState): Pixel[] {
  let pixels = spriteCache.get(f.character.appearance);
  if (!pixels) {
    pixels = spritePixels(f.character.appearance);
    spriteCache.set(f.character.appearance, pixels);
  }
  return pixels;
}

export function renderFight(arena: Painter, state: FightState, sparks: Spark[]): Painter {
  const p = arena.clone();
  state.fighters.forEach((f) => drawFighter(p, f, state.frame));
  state.fighters.forEach((f) => drawAttack(p, f, state.frame));
  for (const s of sparks) drawSpark(p, s);
  return p;
}

function drawFighter(p: Painter, f: FighterState, frame: number): void {
  let x = Math.round(f.x) - SPRITE_WIDTH / 2;
  const a = f.action;
  if (a) x += a.frame <= a.startup ? -f.facing : f.facing * 3;
  const flash = f.hitstun > 0 && f.hitstun % 6 < 3;
  const pixels = flash ? pixelsFor(f).map((px) => ({ ...px, fill: '#ffffff' })) : pixelsFor(f);

  if (a?.slot === 'ultimate' && a.frame <= a.startup) {
    // Charging aura around the fighter.
    const color = frame % 4 < 2 ? '#ffe66d' : '#ffffff';
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2 + frame * 0.2;
      p.set(f.x + Math.cos(angle) * 20, GROUND_Y - 24 + Math.sin(angle) * 28, color);
    }
  }
  p.sprite(x, GROUND_Y - SPRITE_HEIGHT, pixels, SPRITE_WIDTH, f.facing === -1);
}

function drawAttack(p: Painter, f: FighterState, frame: number): void {
  const a = f.action;
  // The ultimate's beam stays on screen longer than its hitbox so it can be seen.
  const showBeam = a?.slot === 'ultimate' && a.frame > a.startup && a.frame <= a.startup + Math.max(18, a.active);
  if (!a || !(isActive(f) || showBeam)) return;
  const front = f.x + f.facing * 12;
  const reach = reachOf(a.move);
  const box = (dx: number, y: number, w: number, h: number, color: string): void => {
    const x0 = f.facing === 1 ? front + dx : front - dx - w;
    p.rect(Math.round(x0), y, w, h, color);
  };

  const thrown = projectileX(f);
  if (thrown !== null) {
    drawProjectile(p, a.move.id, thrown, f.facing, frame);
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
    case 'tomato-rain':
      for (let i = 0; i < 6; i++) {
        const dx = 20 + ((i * 37 + frame) % Math.max(1, reach - 30));
        const y = ((frame * 4 + i * 23) % 70) + 40;
        drawTomato(p, Math.round(f.x + f.facing * dx), y);
      }
      return;
  }

  switch (a.slot) {
    case 'light':
      box(reach - 18, CHEST_Y, 5, 4, '#f2f2f2');
      box(reach - 24, CHEST_Y + 1, 5, 1, '#9aa5b1');
      return;
    case 'heavy':
      box(reach - 20, CHEST_Y - 3, 8, 7, '#ffe66d');
      box(reach - 30, CHEST_Y - 1, 9, 1, '#ffffff');
      box(reach - 30, CHEST_Y + 2, 9, 1, '#ffffff');
      return;
    case 'kick':
      box(reach - 20, KNEE_Y, 9, 4, '#f2f2f2');
      box(reach - 30, KNEE_Y + 1, 9, 1, '#9aa5b1');
      return;
    case 'special': {
      const [c1, c2] = SPECIAL_COLORS[a.move.id] ?? ['#ffffff', '#cccccc'];
      const dx = (reach - 16) * Math.min(1, (a.frame - a.startup) / a.active);
      box(dx, CHEST_Y - 3, 6, 6, c1);
      box(dx + 1, CHEST_Y - 2, 2, 2, c2);
      box(dx - 6, CHEST_Y, 5, 1, c2);
      return;
    }
    case 'ultimate': {
      const [c1, c2] = ULTIMATE_COLORS[a.move.id] ?? ['#ffe66d', '#ffffff'];
      for (let i = 0; i < reach; i++) {
        const wave = Math.round(Math.sin((i + frame) * 0.5) * 2);
        box(i, CHEST_Y - 8 + wave, 1, 16, (i + frame) % 6 < 3 ? c1 : c2);
      }
      if (a.move.id === 'blue-screen') {
        box(reach - 40, CHEST_Y - 12, 34, 24, '#0a3dcc');
        const tx = Math.round(f.facing === 1 ? front + reach - 36 : front - reach + 10);
        p.text(tx, CHEST_Y - 8, ':(', '#ffffff');
        p.text(tx, CHEST_Y, 'ERROR', '#ffffff');
      }
      return;
    }
  }
}

function drawTomato(p: Painter, x: number, y: number): void {
  p.rect(x - 4, y - 2, 9, 6, '#140c1c');
  p.rect(x - 3, y - 3, 7, 8, '#140c1c');
  p.rect(x - 3, y - 2, 7, 6, '#d62828');
  p.rect(x - 2, y - 3, 5, 8, '#d62828');
  p.rect(x - 2, y + 3, 5, 1, '#a61b1b');
  p.rect(x - 2, y - 2, 2, 2, '#ff8a80');
  p.rect(x - 1, y - 4, 3, 1, '#2b9348');
  p.set(x, y - 5, '#2b9348');
}

function drawProjectile(p: Painter, id: string, x: number, facing: 1 | -1, frame: number): void {
  const px = Math.round(x);
  switch (id) {
    case 'tomato-throw':
      drawTomato(p, px, CHEST_Y - 2 + Math.round(Math.sin(frame * 0.4) * 2));
      return;
    case 'hdd-throw': {
      const spin = frame % 8 < 4;
      const w = spin ? 12 : 8;
      const h = spin ? 8 : 11;
      p.rect(px - w / 2 - 1, CHEST_Y - h / 2 - 1, w + 2, h + 2, '#140c1c');
      p.rect(px - w / 2, CHEST_Y - h / 2, w, h, '#9aa5b1');
      p.rect(px - 2, CHEST_Y - 2, 4, 4, '#5a6470');
      p.set(px + w / 2 - 2, CHEST_Y + h / 2 - 2, '#39ff88');
      return;
    }
    case 'tank-roll':
      drawTank(p, px, facing, frame);
      return;
    case 'coffee-throw':
      p.rect(px - 2, CHEST_Y - 3, 5, 6, '#f2f2f2');
      p.rect(px - 1, CHEST_Y - 3, 3, 1, '#6f3b1a');
      p.rect(px - 2 - facing * 4, CHEST_Y - 1, 3, 1, '#6f3b1a');
      return;
    default: {
      const [c1, c2] = SPECIAL_COLORS[id] ?? ['#ffffff', '#cccccc'];
      p.rect(px - 3, CHEST_Y - 3, 6, 6, c1);
      p.rect(px - 2, CHEST_Y - 2, 2, 2, c2);
    }
  }
}

/** A small tank that rolls along the floor. */
function drawTank(p: Painter, x: number, facing: 1 | -1, frame: number): void {
  const hull = '#4b5320';
  const dark = '#2f3514';
  const g = GROUND_Y;
  p.rect(x - 16, g - 8, 32, 8, '#1c1c1c');
  for (let i = 0; i < 6; i++) p.rect(x - 14 + i * 5 + (frame % 2), g - 6, 3, 4, '#555555');
  p.rect(x - 15, g - 16, 30, 8, hull);
  p.hline(x - 15, g - 16, 30, '#6b7a2e');
  p.rect(x - 8, g - 22, 14, 6, dark);
  p.rect(facing === 1 ? x + 6 : x - 22, g - 20, 16, 2, dark);
  p.rect(x - 4, g - 13, 4, 3, '#e8c547');
}

function drawSpark(p: Painter, s: Spark): void {
  const r = s.big ? 10 - s.life / 3 : 5 - s.life / 4;
  const color = s.life % 4 < 2 ? '#ffffff' : '#ffe66d';
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    p.set(s.x + Math.cos(angle) * r, s.y + Math.sin(angle) * r, color);
    p.set(s.x + Math.cos(angle) * (r - 2), s.y + Math.sin(angle) * (r - 2), color);
  }
}
