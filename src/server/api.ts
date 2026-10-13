import express, { NextFunction, Request, Response, Router } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { EDIT_TOKEN_HEADER } from '../app/shared/api';
import { JsonFileStorage } from './file-storage';
import { GameDataError, GameDataRules } from './game-data';
import { rateLimit } from './rate-limit';

/** A finished online fight between two saved fighters, as the online server reports it. */
export interface OnlineResult {
  winner: { id: string; token: string };
  loser: { id: string; token: string };
  arenaId: string;
}

export interface GameApi {
  router: Router;
  /** Counts an online fight, but only if both players proved they own their fighters. */
  recordOnline(result: OnlineResult): Promise<void>;
}

const sha256 = (token: string): string => createHash('sha256').update(token).digest('hex');

/**
 * REST routes for fighters and statistics, backed by one JSON file.
 * The file is read on the first request, not at import time, so building
 * and prerendering the app never touches it.
 *
 * Changing a fighter needs its edit token (header X-Edit-Token), which only its creator's
 * browser has. Match results are not accepted from browsers; the online server records them.
 */
export function gameApi(storage: JsonFileStorage): GameApi {
  let rules: Promise<GameDataRules> | null = null;
  const getRules = (): Promise<GameDataRules> => {
    rules ??= storage
      .load()
      .then((data) => new GameDataRules(data, randomUUID, () => new Date(), sha256))
      .catch((error) => {
        rules = null;
        throw error;
      });
    return rules;
  };

  const handle =
    (fn: (r: GameDataRules, req: Request) => unknown, status = 200) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const r = await getRules();
        const result = fn(r, req);
        if (req.method !== 'GET') await storage.save(r.snapshot());
        res.status(status).json(result);
      } catch (error) {
        next(error);
      }
    };
  const token = (req: Request): string | undefined => req.get(EDIT_TOKEN_HEADER);

  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));
  // Reading is cheap, writing touches the data file, a new fighter adds to it for good.
  router.use(rateLimit(600, 60_000));
  const writes = rateLimit(60, 60_000);
  const creates = rateLimit(20, 60 * 60_000);

  router.get('/fighters', handle((r) => r.listFighters()));
  router.get('/fighters/:id', handle((r, req) => r.getFighter(String(req.params['id']))));
  router.post('/fighters', creates, handle((r, req) => r.createFighter(req.body), 201));
  router.put('/fighters/:id', writes, handle((r, req) => r.updateFighter(String(req.params['id']), req.body, token(req))));
  router.post('/fighters/:id/ladder', writes, handle((r, req) => r.recordLadder(String(req.params['id']), req.body, token(req)), 201));
  router.get('/stats', handle((r) => r.summary()));
  // Anything else under /api is unknown, instead of falling through to the page renderer.
  router.use((_req, res) => void res.status(404).json({ error: 'Unbekannte Adresse.' }));

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof GameDataError) {
      res.status(error.status).json({ error: error.message });
    } else if ((error as { type?: string }).type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Ungültiges JSON.' });
    } else if ((error as { type?: string }).type === 'entity.too.large') {
      res.status(413).json({ error: 'Anfrage zu groß.' });
    } else {
      next(error);
    }
  });

  const recordOnline = async ({ winner, loser, arenaId }: OnlineResult): Promise<void> => {
    try {
      const r = await getRules();
      if (winner.id === loser.id || !r.owns(winner.id, winner.token) || !r.owns(loser.id, loser.token)) return;
      r.recordMatch({ winnerId: winner.id, loserId: loser.id, arenaId });
      await storage.save(r.snapshot());
    } catch (error) {
      console.error('Recording an online result failed', error);
    }
  };
  return { router, recordOnline };
}
