import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { ContentLoader } from './content/content-loader';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { FightReuseStrategy } from './fight/fight-reuse';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    { provide: RouteReuseStrategy, useClass: FightReuseStrategy },
    provideHttpClient(withFetch()),
    provideClientHydration(withEventReplay()),
    // Content packs from the server join the game before the first screen shows.
    provideAppInitializer(() => inject(ContentLoader).load()),
  ]
};
