import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // The fight reads its arena from the query string, so it is rendered on demand.
  { path: 'fight', renderMode: RenderMode.Client },
  // Online fights need a live connection, so there is nothing to prerender.
  { path: 'online', renderMode: RenderMode.Client },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
