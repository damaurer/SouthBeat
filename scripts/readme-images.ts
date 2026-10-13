// Renders the pixel art shown in the README straight from the game code, scaled up without
// smoothing: npm run images. Writes PNG files to docs/images.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { ARENAS, paintArena } from '../src/app/arena/arenas';
import { Painter, seeded } from '../src/app/arena/painter';
import { defaultCharacter } from '../src/app/character/balance';
import { SPARRING_PARTNER } from '../src/app/character/sparring';
import { SPRITE_HEIGHT, SPRITE_WIDTH, spritePixels } from '../src/app/character/sprite';
import { BEST_OF_THREE, Controls, NO_INPUT, createFight, step } from '../src/app/fight/combat';
import { cpuControls } from '../src/app/fight/cpu';
import { Effects } from '../src/app/fight/effects';
import { fightEffects, renderFight } from '../src/app/fight/render';
import { TitleScene } from '../src/app/home/title-scene';
import { OPPONENTS } from '../src/app/singleplayer/opponents';
import { createCampaign, stepCampaign } from '../src/app/stage/campaign';
import { renderStage, stageEffects } from '../src/app/stage/render-stage';
import { paintStage } from '../src/app/stage/stages';

const OUT = 'docs/images';
const BACKGROUND = '#14141f';

/** A PNG of the painter, every pixel as a square of `scale` pixels. */
function png(p: Painter, scale: number): Buffer {
  const w = p.width * scale;
  const h = p.height * scale;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    for (let x = 0; x < w; x++) {
      const c = p.data[Math.floor(y / scale) * p.width + Math.floor(x / scale)];
      raw[row + 1 + x * 3] = c & 0xff;
      raw[row + 2 + x * 3] = (c >> 8) & 0xff;
      raw[row + 3 + x * 3] = (c >> 16) & 0xff;
    }
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function save(name: string, p: Painter, scale: number): void {
  writeFileSync(`${OUT}/${name}.png`, png(p, scale));
  console.log(`${OUT}/${name}.png`);
}

/** Copies one painter into another at (x, y). */
function paste(into: Painter, from: Painter, x: number, y: number): void {
  for (let dy = 0; dy < from.height; dy++) for (let dx = 0; dx < from.width; dx++) into.data[(y + dy) * into.width + x + dx] = from.data[dy * from.width + dx];
}

mkdirSync(OUT, { recursive: true });
const me = defaultCharacter();

// Title screen: the player's fighter sparring against the boss on the rooftop.
save('title', new TitleScene().render(150, me.appearance, OPPONENTS[OPPONENTS.length - 1].character.appearance), 4);

// All arenas in a grid.
const COLS = 5;
const GAP = 4;
const arenas = ARENAS.map(paintArena);
const { width: aw, height: ah } = arenas[0];
const grid = new Painter(COLS * aw + (COLS + 1) * GAP, Math.ceil(arenas.length / COLS) * (ah + GAP) + GAP, BACKGROUND);
arenas.forEach((a, i) => paste(grid, a, GAP + (i % COLS) * (aw + GAP), GAP + Math.floor(i / COLS) * (ah + GAP)));
save('arenas', grid, 2);

// The fighters: you, the sparring partner and the single-player ladder.
const looks = [me, SPARRING_PARTNER, ...OPPONENTS.map((o) => o.character)].map((c) => c.appearance);
const lineup = new Painter(looks.length * (SPRITE_WIDTH + 4) + 4, SPRITE_HEIGHT + 8, BACKGROUND);
looks.forEach((look, i) => lineup.sprite(4 + i * (SPRITE_WIDTH + 4), 4, spritePixels(look), SPRITE_WIDTH));
save('fighters', lineup, 6);

// A fight against the boss, caught mid-exchange.
const boss = OPPONENTS[OPPONENTS.length - 1];
const fight = createFight(me, boss.character, boss.arenaId, BEST_OF_THREE);
const fx = new Effects();
const random = seeded(7);
let shot: Painter | null = null;
for (let f = 0; f < 600 && !shot; f++) {
  const mine: Controls = f < 160 ? { ...NO_INPUT, right: true } : { ...NO_INPUT, heavy: f % 30 === 0, kick: f % 30 === 15 };
  step(fight, [mine, cpuControls(fight, 1, random, boss.cpu)]);
  fightEffects(fx, fight);
  if (f > 200 && fight.events.some((e) => e.type === 'hit')) {
    // A few frames later the hit spark is at its brightest.
    for (let k = 0; k < 3; k++) {
      step(fight, [NO_INPUT, NO_INPUT]);
      fightEffects(fx, fight);
    }
    shot = renderFight(paintArena(ARENAS.find((a) => a.id === boss.arenaId)!), fight, fx);
  }
}
save('fight', shot ?? renderFight(paintArena(ARENAS[0]), fight, fx), 4);

// The co-op stage mode with a CPU partner.
const campaign = createCampaign([
  { character: me, brain: 'human' },
  { character: SPARRING_PARTNER, brain: 'ally' },
]);
const stageFx = new Effects();
const stageRandom = seeded(3);
for (let f = 0; f < 420; f++) {
  stepCampaign(campaign, [{ ...NO_INPUT, right: f % 120 < 70, light: f % 20 === 0 }, NO_INPUT], stageRandom);
  stageEffects(stageFx, campaign.state);
}
save('stage', renderStage(paintStage(campaign.state.stage), campaign.state, stageFx), 4);

