import { Painter, seeded } from '../arena/painter';

export interface Spark {
  x: number;
  y: number;
  life: number;
  big: boolean;
  /** Blocked hits get a blue guard spark instead of a hit spark. */
  blocked?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  /** Pulled down by gravity (debris) or floating up (dust). */
  gravity: number;
}

interface Seen {
  y: number;
  down: boolean;
  walk: number;
}

/**
 * Game-feel effects that never touch the game state: hit sparks with flying debris,
 * dust clouds when fighters land, fall or start running, and screen shake on heavy hits.
 * Call `step` once per game frame and `draw` when drawing.
 */
export class Effects {
  private sparks: Spark[] = [];
  private particles: Particle[] = [];
  private shake = 0;
  private frame = 0;
  private readonly random = seeded(7);
  private readonly seen = new Map<number, Seen>();

  /** A hit at (x, y); `dir` is the way the blow travels, so debris flies on. */
  hit(x: number, y: number, dir: 1 | -1, opts: { big?: boolean; heavy?: boolean; blocked?: boolean } = {}): void {
    this.sparks.push({ x, y, life: opts.big ? 16 : 12, big: !!opts.big, blocked: opts.blocked });
    const count = opts.blocked ? 4 : opts.big ? 16 : opts.heavy ? 10 : 6;
    const colors = opts.blocked ? ['#ffffff', '#5ad1ff', '#9fd8ff'] : ['#ffffff', '#ffe66d', '#ff9f43', '#ffd1a1'];
    for (let i = 0; i < count; i++) {
      const angle = (this.random() - 0.5) * Math.PI * 1.1;
      const speed = 1 + this.random() * (opts.big ? 3.5 : 2.4);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed * dir,
        vy: Math.sin(angle) * speed - 0.8,
        life: 10 + Math.floor(this.random() * 10),
        color: colors[i % colors.length],
        gravity: 0.18,
      });
    }
    this.shake = Math.max(this.shake, opts.big ? 9 : opts.heavy ? 5 : opts.blocked ? 1 : 2);
  }

  /** A puff of dust on the floor at x. */
  dust(x: number, ground: number, amount = 6, spread = 1): void {
    for (let i = 0; i < amount; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      this.particles.push({
        x: x + side * (2 + this.random() * 6 * spread),
        y: ground - 1 - this.random() * 2,
        vx: side * (0.3 + this.random() * 0.9 * spread),
        vy: -0.15 - this.random() * 0.35,
        life: 14 + Math.floor(this.random() * 10),
        color: this.random() < 0.5 ? '#d9cfc1' : '#b8ad9c',
        gravity: -0.005,
      });
    }
  }

  /**
   * Looks at a fighter once per frame and kicks up dust when it lands from a jump,
   * hits the floor after a knockdown or starts to walk.
   */
  watch(id: number, x: number, ground: number, f: { y?: number; knockedDown: boolean; downFrames: number; walkFrames: number }): void {
    const y = f.y ?? 0;
    const before = this.seen.get(id);
    if (before) {
      if (before.y > 0 && y === 0) this.dust(x, ground, 6);
      if (f.knockedDown && y === 0 && f.downFrames === 8) {
        this.dust(x, ground, 12, 2);
        this.shake = Math.max(this.shake, 4);
      }
      if (before.walk === 0 && f.walkFrames === 1) this.dust(x, ground, 2, 0.5);
      else if (f.walkFrames > 0 && f.walkFrames % 22 === 0) this.dust(x, ground, 1, 0.4);
    }
    this.seen.set(id, { y, down: f.knockedDown, walk: f.walkFrames });
  }

  step(): void {
    this.frame++;
    this.sparks = this.sparks.filter((s) => --s.life > 0);
    this.particles = this.particles.filter((pt) => {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += pt.gravity;
      pt.vx *= 0.94;
      return --pt.life > 0;
    });
    if (this.shake > 0) this.shake--;
  }

  /** Draws sparks and particles; `camX` is the scroll position in the stage mode. */
  draw(p: Painter, camX = 0): void {
    for (const pt of this.particles) {
      const x = Math.round(pt.x - camX);
      const y = Math.round(pt.y);
      p.set(x, y, pt.color);
      if (pt.life > 12) p.set(x + 1, y, pt.color);
    }
    for (const s of this.sparks) drawSpark(p, { ...s, x: s.x - camX });
  }

  /** The picture moved by the current screen shake. */
  shaken(p: Painter): Painter {
    if (this.shake <= 0 || reducedMotion()) return p;
    const strength = Math.ceil(this.shake / 3);
    const dx = (this.frame % 2 === 0 ? 1 : -1) * strength;
    const dy = (this.frame % 4 < 2 ? 1 : -1) * Math.ceil(strength / 2);
    const out = p.clone();
    for (let y = 0; y < p.height; y++) {
      for (let x = 0; x < p.width; x++) {
        out.data[y * p.width + x] = p.word(Math.max(0, Math.min(p.width - 1, x - dx)), Math.max(0, Math.min(p.height - 1, y - dy)));
      }
    }
    return out;
  }

  clear(): void {
    this.sparks = [];
    this.particles = [];
    this.shake = 0;
    this.seen.clear();
  }
}

/** A starburst: a flash in the middle and rays that shoot out and fade. */
export function drawSpark(p: Painter, s: Spark): void {
  const max = s.big ? 16 : 12;
  const age = max - s.life;
  const color = s.blocked ? (s.life % 4 < 2 ? '#ffffff' : '#5ad1ff') : s.life % 4 < 2 ? '#ffffff' : '#ffe66d';
  const rays = s.big ? 12 : 8;
  const inner = age * (s.big ? 1.1 : 0.8);
  const outer = inner + (s.big ? 7 : 4) * (s.life / max);
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2 + (i % 2) * 0.2;
    const long = i % 2 === 0 ? 1 : 0.6;
    for (let r = inner; r <= inner + (outer - inner) * long; r += 1) p.set(s.x + Math.cos(angle) * r, s.y + Math.sin(angle) * r, color);
  }
  if (age < 3) {
    // The flash at the moment of impact.
    const size = s.big ? 5 : 3;
    p.rect(Math.round(s.x) - size, Math.round(s.y) - 1, size * 2 + 1, 3, '#ffffff');
    p.rect(Math.round(s.x) - 1, Math.round(s.y) - size, 3, size * 2 + 1, '#ffffff');
  }
}

/** Players who asked their system for less motion get no screen shake. */
let motionQuery: MediaQueryList | null | undefined;
function reducedMotion(): boolean {
  if (motionQuery === undefined) motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  return !!motionQuery?.matches;
}
