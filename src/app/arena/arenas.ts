import { Painter, seeded, shade } from './painter';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  FLOOR_Y,
  bookshelf,
  ceilingLamp,
  cityWindow,
  coffeeMachine,
  desk,
  floor,
  monitor,
  neon,
  officeChair,
  pizzaBoxes,
  plant,
  serverRack,
  sign,
  stringLights,
  tomatoPlanter,
  wall,
  whiteboard,
} from './props';

export interface Arena {
  id: string;
  name: string;
  description: string;
  draw(p: Painter): void;
}

const bunker: Arena = {
  id: 'bunker',
  name: 'Bunker-Office',
  description: 'Drei Stockwerke unter der Erde. Kein Tageslicht, kein WLAN-Drama, nur Beton und Deadlines.',
  draw(p) {
    const concrete = '#555a60';
    wall(p, concrete);
    for (let y = 0; y < FLOOR_Y - 12; y += 8) {
      p.hline(0, y, ARENA_WIDTH, shade(concrete, -0.15));
      for (let x = (y / 8) % 2 ? 0 : 12; x < ARENA_WIDTH; x += 24) p.vline(x, y, 8, shade(concrete, -0.15));
    }
    p.rect(0, 0, ARENA_WIDTH, 8, '#2e3136');
    p.rect(0, 9, ARENA_WIDTH, 3, '#7a6a52');
    p.hline(0, 9, ARENA_WIDTH, '#9b876a');
    p.rect(0, 14, ARENA_WIDTH, 2, '#4f6a5a');
    for (const x of [40, 120, 200]) {
      p.vline(x + 3, 8, 6, '#222222');
      p.rect(x, 14, 8, 4, '#2e3136');
      p.rect(x + 1, 18, 6, 2, '#ffe9a8');
      p.dither(x - 4, 20, 16, 4, shade(concrete, 0.1), concrete);
    }
    for (let x = 0; x < ARENA_WIDTH; x++) {
      p.rect(x, FLOOR_Y - 10, 1, 5, Math.floor((x + 400) / 5) % 2 ? '#f2c230' : '#1a1a1a');
    }
    p.rect(8, 30, 34, 60, '#6b7078');
    p.frame(8, 30, 34, 60, '#3a3f45');
    p.frame(12, 34, 26, 52, '#4a4f55');
    const wx = 25;
    const wy = 60;
    p.frame(wx - 6, wy - 6, 13, 13, '#c0392b');
    p.hline(wx - 6, wy, 13, '#c0392b');
    p.vline(wx, wy - 6, 13, '#c0392b');
    sign(p, 52, 28, 'B-3', '#f2c230', '#1a1a1a');
    sign(p, 52, 40, 'EXIT', '#1f7a3a', '#e8ffe8');
    desk(p, 78, 74, 50, '#4a4f55', 11, 2);
    officeChair(p, 98, '#3a3f45');
    serverRack(p, 160, 34, 18, 56, 21);
    serverRack(p, 180, 34, 18, 56, 22);
    serverRack(p, 200, 34, 18, 56, 23, '#ffb347');
    p.rect(224, 70, 10, 20, '#3f5a3a');
    p.text(225, 72, 'H2O', '#c8e6c9');
    floor(p, '#45484d', 'concrete', 3);
  },
};

const rooftop: Arena = {
  id: 'rooftop',
  name: 'Dachterrasse-Office',
  description: 'Laptop, Sonnenuntergang, Tomatenbeete und 40 Stockwerke Luft unter den Füßen. Hier oben züchtet der CSO seine Munition.',
  draw(p) {
    p.bands(0, 0, ARENA_WIDTH, FLOOR_Y, ['#2b1e4a', '#4a2a6a', '#8a3b7a', '#d0566e', '#f28a5b', '#ffc26b']);
    p.rect(150, 60, 22, 22, '#ffe08a');
    p.rect(153, 57, 16, 28, '#ffe08a');
    const rnd = seeded(7);
    let x = 0;
    while (x < ARENA_WIDTH) {
      const w = 10 + Math.floor(rnd() * 16);
      const h = 18 + Math.floor(rnd() * 40);
      p.rect(x, FLOOR_Y - h, w, h, rnd() < 0.5 ? '#2a1d3d' : '#3a2650');
      for (let wy = FLOOR_Y - h + 3; wy < FLOOR_Y - 2; wy += 4) {
        for (let wx = x + 2; wx < x + w - 2; wx += 3) if (rnd() < 0.3) p.set(wx, wy, '#ffd56b');
      }
      x += w;
    }
    stringLights(p, 0, 120, 6, 14, ['#ffe08a', '#ff8fb1', '#8fe3ff']);
    stringLights(p, 120, 240, 6, 14, ['#ffe08a', '#ff8fb1', '#8fe3ff']);
    p.rect(0, 80, ARENA_WIDTH, 20, '#9fd3e8');
    p.dither(0, 82, ARENA_WIDTH, 18, '#9fd3e8', '#7fb5cf');
    p.hline(0, 79, ARENA_WIDTH, '#d9dde3');
    p.hline(0, 80, ARENA_WIDTH, '#9aa5b1');
    for (let px = 0; px < ARENA_WIDTH; px += 30) p.vline(px, 80, 20, '#9aa5b1');
    p.vline(60, 40, 44, '#d9dde3');
    for (let i = 0; i < 12; i++) {
      for (let dx = -2 * i - 1; dx <= 2 * i; dx++) p.set(60 + dx, 34 + i, Math.floor((dx + 48) / 6) % 2 ? '#e74c3c' : '#f4f6f8');
    }
    p.rect(46, 84, 30, 2, '#8b5a2b');
    p.rect(49, 86, 2, 14, '#6b4423');
    p.rect(71, 86, 2, 14, '#6b4423');
    p.rect(52, 79, 14, 5, '#c9cdd3');
    monitor(p, 53, 72, 12, 7, 31);
    p.rect(64, 80, 3, 4, '#f2f2f2');
    // The CSO's beloved tomatoes, ammunition included.
    tomatoPlanter(p, 2, 38, FLOOR_Y, 40, 51);
    tomatoPlanter(p, 92, 44, FLOOR_Y, 34, 52);
    tomatoPlanter(p, 190, 48, FLOOR_Y, 44, 53);
    p.rect(150, 92, 30, 4, '#c97b4a');
    p.rect(148, 88, 4, 8, '#c97b4a');
    p.rect(150, 96, 2, 4, '#6b4423');
    p.rect(178, 96, 2, 4, '#6b4423');
    floor(p, '#a0673a', 'wood', 5);
  },
};

const openSpace: Arena = {
  id: 'open-space',
  name: 'Großraumbüro',
  description: '120 Schreibtische, 3 Meetingräume und ein Drucker, der nie funktioniert. Hier wird um jeden Fensterplatz gekämpft.',
  draw(p) {
    wall(p, '#e6e1d6');
    p.rect(0, 0, ARENA_WIDTH, 6, '#f4f1ea');
    for (let x = 10; x < ARENA_WIDTH; x += 60) ceilingLamp(p, x, 6, 30);
    cityWindow(p, 14, 16, 60, 40, ['#8fc9f2', '#b5dcf7', '#d9eefb'], { seed: 1, mullions: 3 });
    cityWindow(p, 166, 16, 60, 40, ['#8fc9f2', '#b5dcf7', '#d9eefb'], { seed: 2, mullions: 3 });
    p.rect(108, 20, 24, 24, '#f4f6f8');
    p.frame(108, 20, 24, 24, '#2b2f3a');
    p.vline(120, 24, 9, '#2b2f3a');
    p.hline(120, 32, 6, '#2b2f3a');
    desk(p, 6, 78, 56, '#d9d3c4', 41, 3);
    desk(p, 92, 78, 56, '#d9d3c4', 44, 3);
    desk(p, 178, 78, 56, '#d9d3c4', 47, 3);
    officeChair(p, 30);
    officeChair(p, 116);
    officeChair(p, 202);
    plant(p, 72);
    plant(p, 158);
    floor(p, '#7d8794', 'carpet', 9);
  },
};

const serverRoom: Arena = {
  id: 'server-room',
  name: 'Serverraum',
  description: '18 Grad, 90 Dezibel Lüfterrauschen. Wer hier den Stecker zieht, legt die Produktion lahm.',
  draw(p) {
    wall(p, '#141a2a');
    p.rect(0, 0, ARENA_WIDTH, 10, '#0c101a');
    for (let x = 0; x < ARENA_WIDTH; x += 4) p.vline(x, 10, 2, '#2b3550');
    p.hline(0, 12, ARENA_WIDTH, '#2b3550');
    for (let x = 0; x < ARENA_WIDTH; x += 40) p.hline(x + 6, 4, 28, '#5ad1ff');
    for (let i = 0; i < 11; i++) {
      serverRack(p, 4 + i * 21, 20, 19, 76, 100 + i, i % 4 === 3 ? '#5ad1ff' : '#39ff88');
    }
    p.rect(0, 14, ARENA_WIDTH, 4, '#2b3550');
    for (let x = 6; x < ARENA_WIDTH; x += 9) p.vline(x, 18, 3 + (x % 5), ['#e74c3c', '#f1c40f', '#3498db'][x % 3]);
    sign(p, 98, 24, 'PROD', '#c0392b', '#ffffff');
    floor(p, '#b9c2cc', 'raised', 13);
  },
};

const loft: Arena = {
  id: 'startup-loft',
  name: 'Startup-Loft',
  description: 'Backsteinwände, Kicker, Sitzsäcke und ein Neonschild, das jeden Freitag um 17 Uhr deployt.',
  draw(p) {
    const brick = '#9a4a32';
    wall(p, brick);
    for (let y = 0; y < FLOOR_Y - 3; y += 5) {
      p.hline(0, y, ARENA_WIDTH, '#c8b6a0');
      for (let x = (y / 5) % 2 ? 0 : 6; x < ARENA_WIDTH; x += 12) p.vline(x, y, 5, '#c8b6a0');
    }
    const rnd = seeded(17);
    for (let i = 0; i < 80; i++) {
      p.rect(Math.floor(rnd() * 20) * 12 + 1, Math.floor(rnd() * 19) * 5 + 1, 5, 4, shade(brick, rnd() < 0.5 ? -0.15 : 0.1));
    }
    p.rect(84, 14, 72, 18, '#2a1020');
    neon(p, 92, 19, 'SHIP IT!', '#ff4fd8', '#2a1020');
    for (const x of [30, 70, 170, 210]) {
      p.vline(x, 0, 18, '#222222');
      p.rect(x - 1, 18, 3, 4, '#ffcf6b');
      p.set(x, 22, '#fff2c4');
    }
    p.rect(14, 60, 40, 4, '#e8e8e8');
    p.rect(16, 64, 2, 36, '#555555');
    p.rect(50, 64, 2, 36, '#555555');
    monitor(p, 20, 47, 14, 10, 61);
    monitor(p, 36, 47, 14, 10, 62);
    p.rect(160, 76, 50, 10, '#2e8b57');
    p.frame(160, 76, 50, 10, '#6b4423');
    for (let i = 0; i < 5; i++) p.vline(166 + i * 9, 72, 18, '#c9cdd3');
    p.rect(164, 86, 3, 14, '#6b4423');
    p.rect(203, 86, 3, 14, '#6b4423');
    p.rect(68, 88, 22, 12, '#e67e22');
    p.rect(70, 85, 18, 4, '#f39c12');
    p.rect(122, 88, 22, 12, '#3498db');
    p.rect(124, 85, 18, 4, '#5dade2');
    plant(p, 224);
    floor(p, '#8a6a4a', 'wood', 19);
  },
};

const kitchen: Arena = {
  id: 'kitchen',
  name: 'Teeküche',
  description: 'Der heiligste Ort im Büro. Wer die letzte Tasse Kaffee nimmt und keine neue aufsetzt, muss kämpfen.',
  draw(p) {
    wall(p, '#dfe7e2');
    for (let y = 44; y < 70; y += 4) {
      p.hline(0, y, ARENA_WIDTH, '#b8c4bd');
      for (let x = (y / 4) % 2 ? 0 : 4; x < ARENA_WIDTH; x += 8) p.vline(x, y, 4, '#b8c4bd');
    }
    p.rect(10, 10, 150, 26, '#5b7c99');
    for (let x = 10; x < 160; x += 30) {
      p.frame(x, 10, 30, 26, '#3f5a73');
      p.rect(x + 13, 20, 4, 2, '#c9cdd3');
    }
    p.rect(0, 70, 170, 4, '#c9cdd3');
    p.rect(0, 74, 170, 26, '#5b7c99');
    for (let x = 0; x < 170; x += 34) {
      p.frame(x, 74, 34, 26, '#3f5a73');
      p.rect(x + 15, 80, 4, 2, '#c9cdd3');
    }
    coffeeMachine(p, 18, 70);
    coffeeMachine(p, 32, 70);
    p.rect(60, 66, 20, 4, '#9aa5b1');
    p.vline(72, 58, 8, '#9aa5b1');
    p.hline(72, 58, 5, '#9aa5b1');
    for (let i = 0; i < 6; i++) p.rect(96 + i * 6, 64, 4, 6, ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#ecf0f1', '#9b59b6'][i]);
    p.rect(180, 18, 40, 82, '#ecf0f1');
    p.frame(180, 18, 40, 82, '#9aa5b1');
    p.hline(180, 46, 40, '#9aa5b1');
    p.rect(214, 24, 2, 14, '#9aa5b1');
    p.rect(214, 52, 2, 20, '#9aa5b1');
    p.rect(185, 24, 15, 10, '#fff176');
    p.text(187, 26, 'FIX', '#555555');
    p.rect(198, 54, 12, 10, '#ffab91');
    p.rect(186, 66, 10, 10, '#a5d6a7');
    sign(p, 106, 40, 'KAFFEE', '#6b4423', '#ffe0b2');
    floor(p, '#c9c2b3', 'tiles', 23);
  },
};

const meeting: Arena = {
  id: 'meeting-room',
  name: 'Meetingraum',
  description: 'Das Daily dauert schon 90 Minuten. Zeit, die Diskussion auf andere Weise zu beenden.',
  draw(p) {
    wall(p, '#cfd8dc');
    p.rect(0, 0, ARENA_WIDTH, 6, '#eceff1');
    ceilingLamp(p, 60, 6, 40);
    ceilingLamp(p, 140, 6, 40);
    whiteboard(p, 12, 20, 80, 46, ['TODO:', '- FIX BUG', '- DEPLOY', 'WONTFIX']);
    p.frame(68, 26, 18, 10, '#d62828');
    p.rect(110, 16, 70, 46, '#f4f6f8');
    p.frame(110, 16, 70, 46, '#2b2f3a');
    p.text(114, 19, 'VELOCITY', '#2b2f3a');
    const bars = [8, 14, 11, 20, 26, 6];
    bars.forEach((h, i) => p.rect(118 + i * 9, 56 - h, 6, h, i === 5 ? '#d62828' : '#2a6fdb'));
    p.vline(145, 8, 8, '#555555');
    for (let x = 194; x < 236; x += 1) p.vline(x, 14, 76, x % 14 === 0 ? '#9aa5b1' : '#b3e0f2');
    p.dither(194, 14, 42, 76, '#b3e0f2', '#c8ebf7');
    p.frame(194, 14, 42, 76, '#9aa5b1');
    p.rect(20, 84, 200, 4, '#6b4423');
    p.hline(20, 84, 200, '#8b5a2b');
    p.rect(30, 88, 3, 12, '#4a2f17');
    p.rect(207, 88, 3, 12, '#4a2f17');
    for (const x of [40, 80, 150, 190]) officeChair(p, x, '#37474f');
    p.rect(118, 80, 6, 4, '#f2f2f2');
    floor(p, '#5d6d7e', 'carpet', 29);
  },
};

const cornerOffice: Arena = {
  id: 'corner-office',
  name: 'Chefbüro',
  description: 'Panoramablick über die Stadt bei Nacht. Wer hier gewinnt, bekommt die Gehaltserhöhung.',
  draw(p) {
    wall(p, '#3e2f2a');
    cityWindow(p, 60, 8, 170, 76, ['#0b1026', '#141a3a', '#1f2550', '#2c2f63'], { night: true, seed: 5, frame: '#1a1412', mullions: 4 });
    p.rect(200, 14, 4, 4, '#f4f1de');
    bookshelf(p, 6, 12, 44, 86, 37);
    p.rect(110, 72, 90, 4, '#5a3a22');
    p.hline(110, 72, 90, '#7a5232');
    p.rect(112, 76, 86, 24, '#4a2f1b');
    p.frame(112, 76, 86, 24, '#2e1d10');
    monitor(p, 140, 58, 22, 13, 71);
    p.rect(176, 66, 5, 6, '#c0392b');
    p.rect(126, 69, 8, 3, '#d4a017');
    p.rect(150, 56, 12, 20, '#1a1412');
    plant(p, 214, FLOOR_Y, '#2c2c2c');
    floor(p, '#6b1f2b', 'carpet', 31);
  },
};

const garage: Arena = {
  id: 'garage',
  name: 'Garagen-Start-up',
  description: 'Hier fing alles an: ein alter Röhrenmonitor, ein Klappstuhl und eine Idee, die die Welt verändern sollte.',
  draw(p) {
    wall(p, '#8d8676');
    p.rect(70, 10, 100, 88, '#b0aa9c');
    for (let y = 12; y < 96; y += 7) {
      p.hline(72, y, 96, '#8d8676');
      p.hline(72, y + 1, 96, '#c7c1b3');
    }
    p.frame(70, 10, 100, 88, '#5a5548');
    p.rect(116, 88, 8, 3, '#5a5548');
    p.rect(8, 18, 50, 30, '#c8a06a');
    for (let y = 21; y < 46; y += 4) for (let x = 11; x < 56; x += 4) p.set(x, y, '#8a6a3a');
    p.rect(14, 22, 2, 14, '#7a7a7a');
    p.rect(12, 22, 6, 3, '#7a7a7a');
    p.rect(26, 24, 3, 12, '#c0392b');
    p.rect(25, 34, 5, 3, '#c0392b');
    p.rect(40, 22, 10, 2, '#7a7a7a');
    p.rect(44, 24, 2, 10, '#6b4423');
    p.rect(6, 70, 56, 4, '#8b5a2b');
    p.rect(8, 74, 3, 26, '#6b4423');
    p.rect(57, 74, 3, 26, '#6b4423');
    p.rect(16, 52, 26, 18, '#d8d0b8');
    p.rect(19, 55, 20, 12, '#103018');
    for (let y = 57; y < 66; y += 2) p.hline(21, y, 4 + ((y * 7) % 12), '#39ff88');
    p.rect(44, 66, 12, 4, '#d8d0b8');
    for (let x = 180; x < 232; x += 13) {
      p.rect(x, 30, 11, 2, '#7a7a7a');
      p.rect(x + 1, 22, 9, 8, ['#c0392b', '#2980b9', '#7f8c8d', '#d35400'][(x / 13) % 4 | 0]);
    }
    p.rect(180, 50, 50, 2, '#7a7a7a');
    p.rect(184, 40, 12, 10, '#a0522d');
    p.rect(200, 42, 10, 8, '#c8a06a');
    p.vline(120, 0, 6, '#222222');
    p.rect(118, 6, 5, 5, '#fff2c4');
    floor(p, '#7a776f', 'concrete', 41);
    p.rect(150, 112, 18, 4, '#3c3a36');
    p.rect(154, 110, 10, 8, '#3c3a36');
  },
};

const hackathon: Arena = {
  id: 'hackathon',
  name: 'Hackathon-Nacht',
  description: 'Noch eine Minute bis zur Abgabe. Pizza ist kalt, die Mate ist leer, und nur ein Team kann gewinnen.',
  draw(p) {
    wall(p, '#1a1730');
    for (let x = 0; x < ARENA_WIDTH; x += 30) p.vline(x, 0, FLOOR_Y, '#221e3d');
    p.rect(40, 6, 160, 14, '#5b2a86');
    p.frame(40, 6, 160, 14, '#8e44ad');
    neon(p, 82, 9, 'HACKATHON', '#ffe66d', '#5b2a86');
    p.rect(88, 26, 64, 28, '#0b0d1a');
    p.frame(88, 26, 64, 28, '#3a3f4a');
    p.text(105, 34, '00:59', '#ff4f6d');
    p.text(97, 44, 'SUBMIT!', '#5ad1ff');
    stringLights(p, 0, 80, 24, 10, ['#ff4fd8', '#5ad1ff', '#ffe66d']);
    stringLights(p, 160, 240, 24, 10, ['#ff4fd8', '#5ad1ff', '#ffe66d']);
    for (const x of [6, 168]) {
      p.rect(x, 78, 66, 3, '#c9cdd3');
      p.rect(x + 2, 81, 2, 19, '#6b6f78');
      p.rect(x + 62, 81, 2, 19, '#6b6f78');
      for (let i = 0; i < 3; i++) {
        const lx = x + 4 + i * 21;
        p.rect(lx, 68, 14, 9, '#2b2f3a');
        p.rect(lx + 1, 69, 12, 7, '#1e2433');
        monitor(p, lx, 68, 14, 9, 80 + i + x);
        p.rect(lx - 1, 77, 16, 1, '#9aa5b1');
      }
    }
    pizzaBoxes(p, 56, 78, 3);
    pizzaBoxes(p, 220, 78, 2);
    for (let i = 0; i < 5; i++) p.rect(80 + i * 4, 94 + (i % 2), 2, 6 - (i % 2), i % 2 ? '#2ecc71' : '#f1c40f');
    p.rect(150, 90, 14, 10, '#2c3e50');
    p.text(151, 92, 'MATE', '#f1c40f');
    floor(p, '#2a2640', 'carpet', 43);
  },
};

/** Built-in arenas; installed content packs add theirs at the end. */
export const ARENAS: Arena[] = [bunker, rooftop, openSpace, serverRoom, loft, kitchen, meeting, cornerOffice, garage, hackathon];

export function findArena(id: string): Arena {
  return ARENAS.find((a) => a.id === id) ?? ARENAS[0];
}

export function paintArena(arena: Arena): Painter {
  const p = new Painter(ARENA_WIDTH, ARENA_HEIGHT, '#000000');
  arena.draw(p);
  return p;
}
