import express, { NextFunction, Request, Response, Router } from 'express';
import { randomUUID } from 'node:crypto';
import { JsonFileStorage } from './file-storage';
import { GameDataError, GameDataRules } from './game-data';

/**
 * REST routes for fighters and statistics, backed by one JSON file.
 * The file is read on the first request, not at import time, so building
 * and prerendering the app never touches it.
 */
export function gameApi(storage: JsonFileStorage): Router {
  let rules: Promise<GameDataRules> | null = null;
  const getRules = (): Promise<GameDataRules> => {
    rules ??= storage
      .load()
      .then((data) => new GameDataRules(data, randomUUID))
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

  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));

  router.get('/fighters', handle((r) => r.listFighters()));
  router.get('/fighters/:id', handle((r, req) => r.getFighter(String(req.params['id']))));
  router.post('/fighters', handle((r, req) => r.createFighter(req.body), 201));
  router.put('/fighters/:id', handle((r, req) => r.updateFighter(String(req.params['id']), req.body)));
  router.get('/stats', handle((r) => r.summary()));
  router.post('/matches', handle((r, req) => r.recordMatch(req.body), 201));

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof GameDataError) {
      res.status(error.status).json({ error: error.message });
    } else if ((error as { type?: string }).type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Ungültiges JSON.' });
    } else {
      next(error);
    }
  });
  return router;
}
