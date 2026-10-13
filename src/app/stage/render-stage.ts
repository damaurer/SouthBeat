import { Painter, shade } from '../arena/painter';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../arena/props';
import { usesCustomArt } from '../character/character.model';
import { DEFAULT_ART } from '../character/projectile-art';
import { SPRITE_HEIGHT, SPRITE_WIDTH } from '../character/sprite';
import { reachOf } from '../fight/combat';
import { Spark, cachedSprite, drawArt, drawProjectile, drawSpark } from '../fight/render';
import { Brawler, Item, Projectile, StageState } from './brawl';

/** Screen row of a fighter's feet; deeper on the floor means higher up on screen. */
export function feetY(z: number): number {
  return ARENA_HEIGHT - 3 - Math.round(z);
}

type Drawable = { z: number; draw: (p: Painter) => void };

export function renderStage(world: Painter, state: StageState, sparks: Spark[]): Painter {
  const cam = Math.round(state.cameraX);
  const p = new Painter(ARENA_WIDTH, ARENA_HEIGHT);
  for (let y = 0; y < ARENA_HEIGHT; y++) {
    for (let x = 0; x < ARENA_WIDTH; x++) p.pixels[y * ARENA_WIDTH + x] = world.get(Math.min(world.width - 1, x + cam), y);
  }
  // Painter's order: things further back are drawn first.
  const scene: Drawable[] = [
    ...state.items.map((it) => ({ z: it.z + 0.5, draw: (q: Painter) => drawItem(q, it, cam, state.frame) })),
    ...state.brawlers.filter((b) => !b.out).map((b) => ({ z: b.z, draw: (q: Painter) => drawBrawler(q, b, cam, state.frame) })),
    ...state.projectiles.map((pr) => ({ z: pr.z - 0.1, draw: (q: Painter) => drawShot(q, pr, cam, state.frame) })),
  ];
  scene.sort((a, b) => b.z - a.z).forEach((d) => d.draw(p));
  for (const s of sparks) drawSpark(p, { ...s, x: s.x - cam });
  return p;
}

function drawBrawler(p: Painter, b: Brawler, cam: number, frame: number): void {
  const x = Math.round(b.x) - cam;
  const feet = feetY(b.z);
  // Shadow on the floor.
  shadow(p, x, feet, 7);
  if (b.invulnerable > 0 && frame % 8 < 4) return;
  const flash = b.hitstun > 0 && b.hitstun % 6 < 3 && !b.knockedDown;
  const pixels = cachedSprite(b.character.appearance);
  const fill = (c: string): string => (flash ? '#ffffff' : c);
  if (b.knockedDown) {
    for (const px of pixels) {
      const lx = b.facing === 1 ? SPRITE_HEIGHT - 1 - px.y : px.y;
      p.set(x - SPRITE_HEIGHT / 2 + lx, feet - 1 - Math.floor((SPRITE_WIDTH - 1 - px.x) / 2), fill(px.fill));
    }
    return;
  }
  const a = b.action;
  const lean = a ? (a.frame <= a.startup ? -b.facing : b.facing * 3) : 0;
  const left = x - SPRITE_WIDTH / 2 + lean;
  const top = feet - SPRITE_HEIGHT;
  for (const px of pixels) p.set(left + (b.facing === -1 ? SPRITE_WIDTH - 1 - px.x : px.x), top + px.y, fill(px.fill));
  if (b.weapon) {
    // A keyboard held in the front hand.
    const hx = x + b.facing * (a && a.frame > a.startup ? 14 : 9);
    p.rect(hx - 5, feet - 26, 11, 4, '#1c1c24');
    for (let i = 0; i < 4; i++) p.rect(hx - 4 + i * 3, feet - 25, 2, 1, '#d0d4dc');
  }
  if (a && a.frame > a.startup && a.frame <= a.startup + Math.max(a.active, a.slot === 'ultimate' ? 18 : 0) && !a.move.projectileSpeed) {
    drawSwing(p, b, x, feet, frame);
  }
}

function drawSwing(p: Painter, b: Brawler, x: number, feet: number, frame: number): void {
  const a = b.action!;
  const chest = feet - 30;
  const reach = reachOf(a.move);
  const box = (dx: number, y: number, w: number, h: number, color: string): void => {
    const x0 = b.facing === 1 ? x + 12 + dx : x - 12 - dx - w;
    p.rect(x0, y, w, h, color);
  };
  switch (a.slot) {
    case 'light':
      box(reach - 18, chest, 5, 4, '#f2f2f2');
      return;
    case 'heavy':
      box(reach - 20, chest - 3, 8, 7, '#ffe66d');
      return;
    case 'kick':
      box(reach - 20, feet - 14, 9, 4, '#f2f2f2');
      return;
    case 'special':
      if (a.move.dashSpeed) {
        for (let i = 0; i < 4; i++) box(-30 - (i % 2) * 4, chest - 8 + i * 6, 10, 1, '#ffffff');
      } else {
        box(reach - 20, chest - 3, 6, 6, '#ff8fb1');
      }
      return;
    case 'ultimate':
      for (let i = 0; i < reach + 30; i++) box(i, chest - 8 + Math.round(Math.sin((i + frame) * 0.5) * 2), 1, 16, (i + frame) % 6 < 3 ? '#ffe66d' : '#ff6b1a');
      return;
  }
}

function drawShot(p: Painter, pr: Projectile, cam: number, frame: number): void {
  const x = pr.x - cam;
  const feet = feetY(pr.z);
  if (usesCustomArt(pr.move)) drawArt(p, pr.character.projectileArt ?? DEFAULT_ART, x, feet - 30, pr.dir, frame);
  else drawProjectile(p, pr.move.id, x, pr.dir, frame, feet);
}

function drawItem(p: Painter, it: Item, cam: number, frame: number): void {
  const x = Math.round(it.x) - cam;
  const y = feetY(it.z) - 2 - (frame % 40 < 20 ? 0 : 1);
  shadow(p, x, feetY(it.z), 5);
  switch (it.kind) {
    case 'coffee':
      p.rect(x - 3, y - 7, 6, 7, '#f2f2f2');
      p.rect(x - 3, y - 7, 6, 1, '#6f3b1a');
      p.rect(x + 3, y - 5, 2, 3, '#f2f2f2');
      p.set(x - 1, y - 9, '#cccccc');
      p.set(x + 1, y - 10, '#cccccc');
      return;
    case 'pizza':
      p.rect(x - 7, y - 3, 14, 3, '#c49a6c');
      p.rect(x - 6, y - 5, 12, 2, '#e8b04b');
      p.set(x - 3, y - 5, '#d62828');
      p.set(x + 2, y - 4, '#d62828');
      p.set(x + 4, y - 5, '#d62828');
      return;
    case 'keyboard':
      p.rect(x - 8, y - 4, 16, 4, '#1c1c24');
      for (let i = 0; i < 6; i++) p.rect(x - 7 + i * 2 + (i > 2 ? 1 : 0), y - 3, 1, 1, '#d0d4dc');
      p.rect(x - 4, y - 2, 8, 1, '#d0d4dc');
      return;
  }
}

/** Darkens the floor under a fighter or item. */
function shadow(p: Painter, x: number, feet: number, half: number): void {
  for (let dy = -1; dy <= 0; dy++) {
    const w = dy === 0 ? half : half - 2;
    for (let dx = -w; dx < w; dx++) {
      const px = x + dx;
      const py = feet + dy;
      if (px >= 0 && px < p.width && py >= 0 && py < p.height) p.set(px, py, shade(p.get(px, py), -0.45));
    }
  }
}
