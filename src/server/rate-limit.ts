import { NextFunction, Request, Response } from 'express';

/**
 * A small in-memory limit per IP address: at most `max` requests per window. Enough for one
 * game server; behind a reverse proxy set TRUST_PROXY so the real address is used.
 */
export function rateLimit(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let sweepAt = now() + windowMs;
  return (req: Request, res: Response, next: NextFunction): void => {
    const t = now();
    if (t > sweepAt) {
      // Old entries are dropped now and then, so the map cannot grow forever.
      for (const [ip, entry] of hits) if (entry.resetAt <= t) hits.delete(ip);
      sweepAt = t + windowMs;
    }
    const ip = req.ip ?? 'unknown';
    let entry = hits.get(ip);
    if (!entry || entry.resetAt <= t) hits.set(ip, (entry = { count: 0, resetAt: t + windowMs }));
    entry.count++;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - t) / 1000));
      res.status(429).json({ error: 'Zu viele Anfragen, bitte kurz warten.' });
      return;
    }
    next();
  };
}
