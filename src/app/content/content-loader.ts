import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ContentPack, installPacks } from './content';

/**
 * Fetches the server's content packs when the app starts, so moves, arenas and fighters
 * from packs are there before any screen needs them. On the server they are loaded from disk.
 */
@Injectable({ providedIn: 'root' })
export class ContentLoader {
  private readonly http = inject(HttpClient);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  /** Bumped after every reload, for screens that list content. */
  readonly version = signal(0);

  async load(): Promise<void> {
    if (!this.browser) return;
    try {
      const packs = await firstValueFrom(this.http.get<ContentPack[]>('/api/content'));
      for (const r of installPacks(Array.isArray(packs) ? packs : [])) console.warn(`Inhaltspaket ${r.pack} übersprungen`, r.errors);
      this.version.update((v) => v + 1);
    } catch {
      // Without the server (or offline) the game runs with its built-in content.
    }
  }
}
