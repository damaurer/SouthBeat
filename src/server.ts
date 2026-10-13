import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express, { NextFunction, Request, Response } from 'express';
import { join } from 'node:path';
import { gameApi } from './server/api';
import { JsonFileStorage } from './server/file-storage';
import { OnlineServer } from './server/online';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.disable('x-powered-by');
// Behind a reverse proxy (nginx, Traefik) set TRUST_PROXY=1 so rate limits see the real address.
if (process.env['TRUST_PROXY']) app.set('trust proxy', Number(process.env['TRUST_PROXY']) || process.env['TRUST_PROXY']);

/**
 * Security headers, set by hand instead of with a library: the page may only load its own
 * files, talk to its own server (also over the WebSocket); photos are read from a chosen file, never from the camera.
 * Angular puts small inline scripts and styles into the server-rendered page, so those stay allowed.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// JavaScript, styles, pages and API answers go out gzip-compressed.
app.use(compression());

/**
 * Fighters and game statistics are saved in one JSON file.
 * Set SOUTHBEAT_DATA_FILE to choose where; the default is data/southbeat.json.
 */
const dataFile = process.env['SOUTHBEAT_DATA_FILE'] || join(process.cwd(), 'data', 'southbeat.json');
const api = gameApi(new JsonFileStorage(dataFile));
app.use('/api', api.router);

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  const server = app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
  // Online fights between two PCs run over a WebSocket on the same port.
  // The online server reports finished duels; the API checks the owners and counts them.
  new OnlineServer(Math.random, (result) => void api.recordOnline(result)).attach(server);
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
