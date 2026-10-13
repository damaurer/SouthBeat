import { Painter } from '../arena/painter';
import { GROUND_Y } from '../arena/props';
import { SPRITE_HEIGHT, SPRITE_WIDTH, Pixel, spritePixels } from '../character/sprite';
import { FightState, FighterState, isActive, reachOf } from './combat';

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
  const showBeam = a?.slot === 'ultimate' && a.frame > a.startup && a.frame <= a.startup + 18;
  if (!a || !(isActive(f) || showBeam)) return;
  const front = f.x + f.facing * 12;
  const reach = reachOf(a.slot);
  const progress = (a.frame - a.startup) / 4;
  const box = (dx: number, y: number, w: number, h: number, color: string): void => {
    const x0 = f.facing === 1 ? front + dx : front - dx - w;
    p.rect(Math.round(x0), y, w, h, color);
  };

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
      const dx = (reach - 16) * Math.min(1, progress);
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

function drawSpark(p: Painter, s: Spark): void {
  const r = s.big ? 10 - s.life / 3 : 5 - s.life / 4;
  const color = s.life % 4 < 2 ? '#ffffff' : '#ffe66d';
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    p.set(s.x + Math.cos(angle) * r, s.y + Math.sin(angle) * r, color);
    p.set(s.x + Math.cos(angle) * (r - 2), s.y + Math.sin(angle) * (r - 2), color);
  }
}
