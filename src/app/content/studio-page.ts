import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ArenaCanvas } from '../arena/arena-canvas';
import { findArena } from '../arena/arenas';
import { SLOT_LABELS, STAT_KEYS, STAT_LABELS, Character } from '../character/character.model';
import { ContentPack, arenaOf, movePower } from './content';
import { ContentLoader } from './content-loader';

type Provider = 'openai' | 'anthropic';

interface Settings {
  provider: Provider;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  keyFromEnv: boolean;
}

interface ChatEntry {
  from: 'you' | 'ai' | 'error';
  text: string;
  steps?: string[];
}

interface PackRow {
  id: string;
  name: string;
  studio: boolean;
  installed: boolean;
}

interface StudioReply {
  sessionId: string;
  text: string;
  draft: ContentPack | null;
  errors: string[];
  steps: string[];
}

const PASSWORD_KEY = 'southbeat.studioPassword';

/** Ready-made settings for the usual LLM servers. */
const PRESETS: { label: string; provider: Provider; baseUrl: string; model: string }[] = [
  { label: 'Ollama (lokal, ohne Key)', provider: 'openai', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
  { label: 'LM Studio (lokal, ohne Key)', provider: 'openai', baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
  { label: 'llama.cpp-Server (lokal, ohne Key)', provider: 'openai', baseUrl: 'http://localhost:8080/v1', model: 'local' },
  { label: 'OpenAI (mit Key)', provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1' },
  { label: 'Anthropic Claude (mit Key)', provider: 'anthropic', baseUrl: '', model: 'claude-opus-5-5' },
];

const EXAMPLES = [
  'Ein Bonus-Gegner: die Scrum-Masterin, die mit Haftnotizen wirft und ein Daily-Standup als Ultimate hat. Arena: ein Agile-Raum voller Whiteboards.',
  'Eine neue Arena: Rechenzentrum bei Nacht mit Serverschränken, Neonschild "UPTIME" und Lichterketten.',
  'Ein schneller Kämpfer, der Praktikant, mit einer Kaffee-Sturmangriff-Attacke.',
];

/**
 * The content studio: describe new opponents, arenas, fighters and attacks in words, an LLM
 * builds them as a content pack that passes the game's rules, you look at the preview and
 * decide whether it goes into the game.
 */
@Component({
  selector: 'app-studio-page',
  imports: [FormsModule, RouterLink, ArenaCanvas],
  templateUrl: './studio-page.html',
  styleUrl: './studio-page.scss',
})
export class StudioPage {
  private readonly http = inject(HttpClient);
  private readonly loader = inject(ContentLoader);

  protected readonly presets = PRESETS;
  protected readonly examples = EXAMPLES;
  protected readonly slotLabels = SLOT_LABELS;
  protected readonly statKeys = STAT_KEYS;
  protected readonly statLabels = STAT_LABELS;

  protected readonly access = signal<'checking' | 'ok' | 'password' | 'denied'>('checking');
  protected readonly accessMessage = signal('');
  protected password = read(PASSWORD_KEY);

  protected readonly settings = signal<Settings | null>(null);
  protected form = { provider: 'openai' as Provider, baseUrl: '', model: '', apiKey: '' };
  protected readonly settingsNote = signal('');

  protected readonly chat = signal<ChatEntry[]>([]);
  protected message = '';
  protected readonly busy = signal(false);
  private sessionId: string | null = null;

  protected readonly draft = signal<ContentPack | null>(null);
  protected readonly draftErrors = signal<string[]>([]);
  protected readonly json = signal('');
  protected readonly jsonOpen = signal(false);
  protected readonly installNote = signal('');
  protected readonly packs = signal<PackRow[]>([]);

  protected readonly arenas = computed(() => (this.draft()?.arenas ?? []).map(arenaOf));
  /** Fighters and opponents of the draft, shown in their own arena (or the bunker). */
  protected readonly cast = computed(() => {
    const d = this.draft();
    if (!d) return [];
    const arenaFor = (id?: string) => this.arenas().find((a) => a.id === id) ?? findArena(id ?? '');
    return [
      ...(d.fighters ?? []).map((f) => ({ id: f.id, kind: 'Kämpfer', title: f.title, character: f.character, text: f.hitLines?.[0] ?? '', arena: arenaFor(d.arenas?.[0]?.id) })),
      ...(d.opponents ?? []).map((o) => ({ id: o.id, kind: 'Bonus-Gegner', title: o.title, character: o.character, text: o.blurb, arena: arenaFor(o.arenaId) })),
    ];
  });
  protected readonly moves = computed(() => (this.draft()?.moves ?? []).map((m) => ({ ...m, power: movePower(m) })));

  constructor() {
    void this.start();
  }

  private headers(): HttpHeaders {
    return this.password ? new HttpHeaders({ 'X-Studio-Password': this.password }) : new HttpHeaders();
  }

  protected async start(): Promise<void> {
    try {
      const s = await firstValueFrom(this.http.get<Settings>('/api/studio/settings', { headers: this.headers() }));
      write(PASSWORD_KEY, this.password);
      this.applySettings(s);
      this.access.set('ok');
      await this.refreshPacks();
    } catch (error) {
      const e = error as HttpErrorResponse;
      this.accessMessage.set(e.error?.error ?? 'Der Server ist nicht erreichbar.');
      this.access.set(e.status === 401 ? 'password' : 'denied');
    }
  }

  private applySettings(s: Settings): void {
    this.settings.set(s);
    this.form = { provider: s.provider, baseUrl: s.baseUrl, model: s.model, apiKey: '' };
  }

  protected usePreset(index: string): void {
    const p = PRESETS[Number(index)];
    if (p) this.form = { ...this.form, provider: p.provider, baseUrl: p.baseUrl, model: p.model };
  }

  protected async saveSettings(removeKey = false): Promise<void> {
    const body = { provider: this.form.provider, baseUrl: this.form.baseUrl, model: this.form.model, ...(removeKey ? { apiKey: '' } : this.form.apiKey ? { apiKey: this.form.apiKey } : {}) };
    try {
      this.applySettings(await firstValueFrom(this.http.put<Settings>('/api/studio/settings', body, { headers: this.headers() })));
      this.settingsNote.set('Gespeichert. Neue Gespräche nutzen diese Einstellungen.');
      this.newChat();
    } catch (error) {
      this.settingsNote.set((error as HttpErrorResponse).error?.error ?? 'Speichern fehlgeschlagen.');
    }
  }

  protected example(text: string): void {
    this.message = text;
  }

  protected async send(): Promise<void> {
    const text = this.message.trim();
    if (!text || this.busy()) return;
    this.message = '';
    this.chat.update((c) => [...c, { from: 'you', text }]);
    this.busy.set(true);
    try {
      const reply = await firstValueFrom(this.http.post<StudioReply>('/api/studio/chat', { sessionId: this.sessionId, message: text }, { headers: this.headers() }));
      this.sessionId = reply.sessionId;
      this.chat.update((c) => [...c, { from: 'ai', text: reply.text || (reply.draft ? 'Fertig, schau dir die Vorschau an.' : '…'), steps: reply.steps }]);
      if (reply.draft) this.showDraft(reply.draft, reply.errors);
      else if (reply.errors.length) this.draftErrors.set(reply.errors);
    } catch (error) {
      this.chat.update((c) => [...c, { from: 'error', text: (error as HttpErrorResponse).error?.error ?? 'Die Anfrage ist fehlgeschlagen.' }]);
    } finally {
      this.busy.set(false);
    }
  }

  protected newChat(): void {
    if (this.sessionId) void firstValueFrom(this.http.delete(`/api/studio/chat/${this.sessionId}`, { headers: this.headers() })).catch(() => undefined);
    this.sessionId = null;
    this.chat.set([]);
  }

  private showDraft(pack: ContentPack, errors: string[]): void {
    this.draft.set(pack);
    this.draftErrors.set(errors);
    this.json.set(JSON.stringify(pack, null, 2));
    this.installNote.set('');
  }

  /** The JSON can be edited by hand, or pasted in from elsewhere. */
  protected async checkJson(): Promise<void> {
    let pack: ContentPack;
    try {
      pack = JSON.parse(this.json());
    } catch (error) {
      this.draftErrors.set([`Kein gültiges JSON: ${(error as Error).message}`]);
      return;
    }
    const { errors } = await firstValueFrom(this.http.post<{ errors: string[] }>('/api/studio/validate', { pack }, { headers: this.headers() }));
    this.draft.set(pack);
    this.draftErrors.set(errors);
  }

  protected async install(): Promise<void> {
    const pack = this.draft();
    if (!pack) return;
    try {
      await firstValueFrom(this.http.post('/api/studio/packs', { pack }, { headers: this.headers() }));
      await this.loader.load();
      this.installNote.set(`„${pack.name}“ ist jetzt im Spiel. Andere Spieler sehen es nach dem Neuladen der Seite.`);
      await this.refreshPacks();
    } catch (error) {
      const e = (error as HttpErrorResponse).error;
      this.draftErrors.set(e?.errors ?? [e?.error ?? 'Speichern fehlgeschlagen.']);
    }
  }

  protected discard(): void {
    this.draft.set(null);
    this.draftErrors.set([]);
    this.json.set('');
  }

  protected async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/studio/packs/${encodeURIComponent(id)}`, { headers: this.headers() })).catch(() => undefined);
    await this.loader.load();
    await this.refreshPacks();
  }

  private async refreshPacks(): Promise<void> {
    this.packs.set(await firstValueFrom(this.http.get<PackRow[]>('/api/studio/packs', { headers: this.headers() })).catch(() => []));
  }

  protected download(): void {
    const pack = this.draft();
    if (!pack) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pack.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected total(c: Character): number {
    return STAT_KEYS.reduce((sum, k) => sum + c.stats[k], 0);
  }
}

function read(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function write(key: string, value: string): void {
  try {
    if (value) sessionStorage.setItem(key, value);
  } catch {
    // Only a convenience.
  }
}
