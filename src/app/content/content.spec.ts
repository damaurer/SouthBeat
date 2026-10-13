import { ARENAS, findArena, paintArena } from '../arena/arenas';
import { MOVES, findMove } from '../character/character.model';
import { builtInFighter, roster } from '../select/roster';
import { OPPONENTS, findOpponent } from '../singleplayer/opponents';
import { defaultCharacter } from '../character/balance';
import { ContentPack, MOVE_RULES, clearContent, installPacks, installedContent, moveErrors, packErrors } from './content';
import { contentPackSchema } from './content-schema';
import example from '../../../content/examples/netzwerk-pack.json';
import schemaFile from '../../../content/schema/content-pack.schema.json';

const pack = (): ContentPack => JSON.parse(JSON.stringify(example)) as ContentPack;

describe('content packs', () => {
  afterEach(() => clearContent());

  it('accepts the example pack and adds everything to the game', () => {
    expect(packErrors(pack())).toEqual([]);
    const moves = MOVES.length;
    expect(installPacks([pack()])).toEqual([]);
    expect(MOVES.length).toBe(moves + 2);
    expect(findMove('firewall')?.look?.label).toBe('FIREWALL');
    expect(findArena('netzwerk-keller').name).toBe('Netzwerk-Keller');
    expect(paintArena(findArena('netzwerk-keller')).pixels.length).toBe(240 * 135);
    expect(builtInFighter('nadia-netz')?.character.name).toBe('Nadia Netz');
    expect(roster(defaultCharacter(), []).some((e) => e.id === 'nadia-netz')).toBeTrue();
    expect(OPPONENTS.at(-1)?.id).toBe('boris-backup');
    expect(installedContent().map((p) => p.id)).toEqual(['netzwerk-pack']);
  });

  it('takes everything out again and can install a pack twice in a row', () => {
    const before = [MOVES.length, ARENAS.length, OPPONENTS.length];
    installPacks([pack()]);
    installPacks([pack()]);
    expect(installedContent().length).toBe(1);
    clearContent();
    expect([MOVES.length, ARENAS.length, OPPONENTS.length]).toEqual(before);
    expect(findOpponent('boris-backup')).toBeUndefined();
  });

  it('keeps the built-in moves within the rules it asks of packs', () => {
    for (const m of MOVES.filter((x) => !x.exclusive)) expect(moveErrors(m, m.id)).withContext(m.id).toEqual([]);
  });

  it('rejects unbalanced moves with an explanation', () => {
    const p = pack();
    p.moves![1] = { ...p.moves![1], damage: 36, startupFrames: 10 };
    const errors = packErrors(p);
    expect(errors.join(' ')).toContain('unausgewogen');
    const fast = pack();
    fast.moves![0] = { ...fast.moves![0], damage: 9 };
    expect(packErrors(fast).join(' ')).toContain('Geschosse');
  });

  it('rejects taken ids, unknown moves, broken arenas and overbudget fighters', () => {
    const p = pack();
    p.moves!.push({ ...p.moves![0], id: 'keyboard-jab' });
    p.arenas![0].props.push({ type: 'rocket', x: 1 } as never);
    p.fighters![0].character.stats.speed = 10;
    p.opponents![0].character.moves.special = 'tank-roll';
    p.opponents![0].arenaId = 'mars';
    const errors = packErrors(p).join('\n');
    expect(errors).toContain('"keyboard-jab" gibt es schon');
    expect(errors).toContain('unbekannter Prop-Typ "rocket"');
    expect(errors).toContain('höchstens 22 Punkte');
    expect(errors).toContain('arenaId "mars"');
    expect(errors).toContain('Ungültiger Move für special');
  });

  it('does not let players pick a pack signature move in the editor', () => {
    installPacks([pack()]);
    const c = defaultCharacter();
    c.moves.special = 'packet-loss';
    expect(packErrors({ id: 'x-pack', name: 'Extra', version: 1, fighters: [{ id: 'x1', title: 'X', character: c }] }).join(' ')).toContain('Ungültiger Move');
  });

  it('skips a broken pack but installs the good one', () => {
    const rejected = installPacks([{ id: 'Kaputt', name: '', version: 2 } as never, pack()]);
    expect(rejected.length).toBe(1);
    expect(installedContent().map((p) => p.id)).toEqual(['netzwerk-pack']);
  });

  it('ships a schema file that matches the rules in the code', () => {
    expect(schemaFile as unknown).toEqual(contentPackSchema());
    expect(Object.keys(MOVE_RULES)).toEqual(['light', 'heavy', 'kick', 'special', 'ultimate']);
  });
});
