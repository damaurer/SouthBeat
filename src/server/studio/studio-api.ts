import express, { NextFunction, Request, Response, Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ContentPack, cleanPack, installPacks, installedContent, packErrors, takenIds } from '../../app/content/content';
import { ContentFiles } from '../content-files';
import { rateLimit } from '../rate-limit';
import { StudioAgent } from './agent';
import { LlmError } from './llm';
import { StudioSettings } from './settings';

export const STUDIO_PASSWORD_HEADER = 'X-Studio-Password';

/**
 * Loads all packs from disk into the game. Shipped packs first, then the studio's; a pack
 * that does not pass the checks is skipped with a message in the log.
 */
export async function loadContent(files: ContentFiles): Promise<void> {
  const { packs, broken } = await files.load();
  for (const b of broken) console.error(`Inhaltspaket kaputt: ${b}`);
  for (const r of installPacks(packs.map((p) => p.pack))) console.error(`Inhaltspaket ${r.pack} übersprungen: ${r.errors.join(' | ')}`);
}

/**
 * The content studio: it changes what every player sees, so only the server's own PC may use
 * it, or whoever knows SOUTHBEAT_STUDIO_PASSWORD when one is set.
 */
export function studioGuard(password: string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (password) {
      const given = Buffer.from(req.get(STUDIO_PASSWORD_HEADER) ?? '');
      const want = Buffer.from(password);
      if (given.length === want.length && timingSafeEqual(given, want)) return next();
      res.status(401).json({ error: 'Passwort für das Content-Studio fehlt oder ist falsch.', needsPassword: true });
      return;
    }
    const address = req.socket.remoteAddress ?? '';
    if (['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return next();
    res.status(403).json({
      error: 'Das Content-Studio geht ohne Passwort nur auf dem PC, auf dem der Server läuft. Für andere Geräte SOUTHBEAT_STUDIO_PASSWORD setzen.',
      needsPassword: false,
    });
  };
}

export interface StudioOptions {
  files: ContentFiles;
  settings: StudioSettings;
  password?: string;
}

/** /api/content for everyone, /api/studio/* for the studio. */
export function studioApi({ files, settings, password }: StudioOptions): Router {
  const agent = new StudioAgent(() => settings.get());
  const router = express.Router();
  router.use(express.json({ limit: '256kb' }));

  // Every browser loads the installed packs at start, so all players see the same content.
  router.get('/content', (_req, res) => {
    res.json(installedContent());
  });

  const studio = express.Router();
  studio.use(studioGuard(password));
  studio.use(rateLimit(120, 60_000));
  const wrap =
    (fn: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction): void => {
      fn(req, res).then(
        (body) => void (res.headersSent || res.json(body)),
        (error) => {
          if (error instanceof LlmError) res.status(502).json({ error: error.message });
          else if (error instanceof Error && error.message && !res.headersSent) res.status(400).json({ error: error.message });
          else next(error);
        },
      );
    };

  studio.get('/settings', wrap(() => settings.publicView()));
  studio.put('/settings', wrap((req) => settings.update(req.body ?? {})));
  studio.post(
    '/chat',
    rateLimit(30, 60_000),
    wrap(async (req) => {
      const { sessionId, message } = req.body ?? {};
      if (typeof message !== 'string' || !message.trim() || message.length > 4000) throw new Error('Bitte eine Nachricht mit bis zu 4000 Zeichen schreiben.');
      return agent.chat(typeof sessionId === 'string' ? sessionId : null, message.trim());
    }),
  );
  studio.delete(
    '/chat/:id',
    wrap(async (req) => {
      agent.forget(String(req.params['id']));
      return { ok: true };
    }),
  );
  studio.post(
    '/validate',
    wrap(async (req) => {
      const pack = req.body?.pack as ContentPack;
      return { errors: packErrors(pack, takenIds(pack?.id)) };
    }),
  );
  studio.post(
    '/packs',
    wrap(async (req, res) => {
      const pack = req.body?.pack as ContentPack;
      const errors = packErrors(pack, takenIds(pack?.id));
      if (errors.length > 0) {
        res.status(400).json({ error: 'Das Paket hat Fehler.', errors });
        return;
      }
      const shipped = (await files.load()).packs.some((p) => !p.studio && p.pack?.id === pack.id);
      if (shipped) throw new Error(`Das Paket "${pack.id}" gehört zum Spiel und kann hier nicht überschrieben werden. Bitte eine andere id wählen.`);
      await files.saveStudioPack(cleanPack(pack));
      await loadContent(files);
      return { installed: installedContent().map((p) => p.id) };
    }),
  );
  studio.get(
    '/packs',
    wrap(async () => (await files.load()).packs.map((p) => ({ id: p.pack?.id, name: p.pack?.name, studio: p.studio, installed: installedContent().some((i) => i.id === p.pack?.id) }))),
  );
  studio.delete(
    '/packs/:id',
    wrap(async (req) => {
      await files.deleteStudioPack(String(req.params['id']));
      await loadContent(files);
      return { installed: installedContent().map((p) => p.id) };
    }),
  );
  router.use('/studio', studio);
  return router;
}
