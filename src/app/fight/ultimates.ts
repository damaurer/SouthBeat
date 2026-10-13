import { Painter } from '../arena/painter';
import { findMove } from '../character/character.model';

/** Where an ultimate is drawn: in front of the fighter, along the ground of the fight or the stage. */
export interface UltimateSpot {
  /** Pixel just in front of the fighter. */
  front: number;
  facing: 1 | -1;
  reach: number;
  chest: number;
  ground: number;
  frame: number;
}

/** Beam colours of the ultimates that are drawn as a beam. */
const BEAMS: Record<string, [string, string]> = {
  'friday-deploy': ['#ff6b1a', '#ffe66d'],
  'rm-rf': ['#d62828', '#1a1a1a'],
  'blue-screen': ['#0a3dcc', '#ffffff'],
  'infinite-loop': ['#9b59ff', '#5ad1ff'],
  'git-push-force': ['#f05033', '#ffffff'],
  'prod-hotfix': ['#ff3b1f', '#ffd23f'],
  'kernel-panic': ['#1a1d24', '#39ff88'],
};

/** Draws the visible part of an ultimate; the hit itself is decided by the engines. */
export function drawUltimate(p: Painter, id: string, s: UltimateSpot): void {
  const { front, facing, reach, chest, ground, frame } = s;
  const box = (dx: number, y: number, w: number, h: number, color: string): void => {
    const x0 = facing === 1 ? front + dx : front - dx - w;
    p.rect(Math.round(x0), Math.round(y), w, h, color);
  };
  const label = (dx: number, y: number, text: string, color: string): void => {
    // A dark plate keeps the text readable on light walls.
    const w = text.length * 4 - 1;
    const x = Math.round(facing === 1 ? front + dx : front - dx - w);
    p.rect(x - 2, y - 2, w + 4, 9, '#140c1c');
    p.text(x, y, text, color);
  };
  const beam = (colors: [string, string]): void => {
    for (let i = 0; i < reach; i++) {
      const wave = Math.round(Math.sin((i + frame) * 0.5) * 2);
      box(i, chest - 8 + wave, 1, 16, (i + frame) % 6 < 3 ? colors[0] : colors[1]);
    }
  };

  switch (id) {
    case 'tomato-rain':
      for (let i = 0; i < 6; i++) {
        const dx = 20 + ((i * 37 + frame) % Math.max(1, reach - 30));
        const y = ((frame * 4 + i * 23) % 70) + ground - 80;
        drawTomato(p, Math.round(front + facing * dx), y);
      }
      return;
    case 'mandatory-meeting':
      // A swarm of calendar invites.
      for (let i = 0; i < 7; i++) {
        const dx = (frame * 5 + i * 19) % Math.max(1, reach);
        const y = chest - 14 + ((i * 11) % 26) + Math.round(Math.sin((frame + i * 3) * 0.4) * 2);
        box(dx - 1, y - 1, 11, 10, '#140c1c');
        box(dx, y, 9, 8, '#f2f2f2');
        box(dx, y, 9, 2, '#d62828');
        box(dx + 2, y + 4, 2, 1, '#9aa5b1');
        box(dx + 5, y + 4, 2, 1, '#9aa5b1');
        box(dx + 2, y + 6, 2, 1, '#9aa5b1');
      }
      label(reach / 2 - 20, chest - 26, 'PFLICHT!', '#ffe66d');
      return;
    case 'reorg': {
      // Org-chart boxes crash down onto everyone in reach.
      const drop = Math.min(1, ((frame * 7) % 40) / 24);
      for (let i = 0; i < 4; i++) {
        const dx = 14 + i * Math.max(12, (reach - 30) / 4);
        const y = ground - 70 + drop * 52 - (i % 2) * 8;
        box(dx - 1, y - 1, 16, 12, '#140c1c');
        box(dx, y, 14, 10, '#5ad1ff');
        box(dx + 2, y + 3, 10, 1, '#140c1c');
        box(dx + 2, y + 6, 7, 1, '#140c1c');
        box(dx + 6, y - 7, 1, 6, '#9aa5b1');
      }
      box(10, ground - 79, reach - 6, 1, '#9aa5b1');
      label(reach / 2 - 24, ground - 90, 'NEUES ORG!', '#ffffff');
      return;
    }
    case 'sprint-finish':
      // Speed lines and a trail of sticky notes behind the rush.
      for (let i = 0; i < 6; i++) box(-34 - (i % 3) * 6, chest - 12 + i * 5, 14 + (i % 2) * 6, 1, '#ffffff');
      for (let i = 0; i < 3; i++) {
        const dx = -20 - i * 9 - (frame % 4);
        box(dx, chest - 18 + i * 9, 6, 6, ['#ffe66d', '#ff8fb1', '#7dd87d'][i]);
      }
      return;
    case 'ddos': {
      // A stream of packets.
      for (let i = 0; i < 18; i++) {
        const dx = (frame * 6 + i * 13) % Math.max(1, reach);
        const y = chest - 10 + ((i * 7) % 20);
        box(dx, y, 4, 3, i % 3 === 0 ? '#ff5a5a' : '#5ad1ff');
        box(dx - 4, y + 1, 3, 1, '#ffffff');
      }
      return;
    }
    case 'legacy-code':
      // Spaghetti code: tangled green lines and old TODOs.
      for (let line = 0; line < 4; line++) {
        for (let i = 0; i < reach; i++) {
          const y = chest - 10 + line * 6 + Math.round(Math.sin(i * 0.25 + frame * 0.3 + line * 1.7) * 4);
          box(i, y, 1, 1, line % 2 ? '#39ff88' : '#b5e48c');
        }
      }
      label(reach - 40, chest - 22, 'TODO', '#ffe66d');
      label(reach / 2 - 20, chest + 12, 'FIXME', '#ff8fb1');
      return;
  }

  const look = BEAMS[id] ? undefined : findMove(id)?.look;
  beam(BEAMS[id] ?? look?.colors ?? ['#ffe66d', '#ffffff']);
  // Ultimates from content packs can bring a word of their own.
  if (look?.label) label(reach - look.label.length * 4 - 6, chest - 18, look.label.toUpperCase(), '#ffffff');
  switch (id) {
    case 'blue-screen':
      box(reach - 40, chest - 12, 34, 24, '#0a3dcc');
      label(reach - 36, chest - 8, ':(', '#ffffff');
      label(reach - 36, chest, 'ERROR', '#ffffff');
      return;
    case 'rm-rf':
      label(reach - 44, chest - 18, 'RM -RF /', '#ffffff');
      return;
    case 'git-push-force':
      label(reach - 44, chest - 18, '--FORCE', '#ffffff');
      return;
    case 'prod-hotfix':
      for (let i = 0; i < 5; i++) box(reach - 12 - i * 8, chest - 12 - ((frame + i * 3) % 6), 3, 3, '#ffd23f');
      label(reach - 40, chest - 22, 'HOTFIX', '#ffffff');
      return;
    case 'kernel-panic':
      box(reach - 46, chest - 14, 42, 28, '#140c1c');
      label(reach - 43, chest - 11, 'KERNEL', '#39ff88');
      label(reach - 43, chest - 4, 'PANIC!', frame % 8 < 4 ? '#39ff88' : '#ff5a5a');
      label(reach - 43, chest + 3, '0X0BAD', '#39ff88');
      return;
  }
}

export function drawTomato(p: Painter, x: number, y: number): void {
  p.rect(x - 4, y - 2, 9, 6, '#140c1c');
  p.rect(x - 3, y - 3, 7, 8, '#140c1c');
  p.rect(x - 3, y - 2, 7, 6, '#d62828');
  p.rect(x - 2, y - 3, 5, 8, '#d62828');
  p.rect(x - 2, y + 3, 5, 1, '#a61b1b');
  p.rect(x - 2, y - 2, 2, 2, '#ff8a80');
  p.rect(x - 1, y - 4, 3, 1, '#2b9348');
  p.set(x, y - 5, '#2b9348');
}
