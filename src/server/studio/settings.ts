import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { LlmSettings, ProviderKind } from './llm';

/** What the browser may see of the settings: everything but the key. */
export interface PublicSettings {
  provider: ProviderKind;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  /** True if the key comes from an environment variable and cannot be changed here. */
  keyFromEnv: boolean;
}

export const PROVIDER_DEFAULTS: Record<ProviderKind, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
  anthropic: { baseUrl: '', model: 'claude-opus-5-5' },
};

/**
 * LLM settings of the content studio. Environment variables (SOUTHBEAT_LLM_PROVIDER,
 * _BASE_URL, _MODEL, _API_KEY; empty counts as unset) set the defaults; changes from the
 * studio are kept in a small file in the data folder. The key never leaves the server.
 */
export class StudioSettings {
  constructor(
    private readonly file: string,
    private readonly env: Record<string, string | undefined> = process.env,
  ) {}

  async get(): Promise<LlmSettings> {
    const stored = await this.read();
    const provider = (stored.provider ?? (this.env['SOUTHBEAT_LLM_PROVIDER'] || 'openai')) === 'anthropic' ? 'anthropic' : 'openai';
    const defaults = PROVIDER_DEFAULTS[provider];
    return {
      provider,
      baseUrl: stored.baseUrl ?? (this.env['SOUTHBEAT_LLM_BASE_URL'] || defaults.baseUrl),
      model: stored.model ?? (this.env['SOUTHBEAT_LLM_MODEL'] || defaults.model),
      apiKey: this.env['SOUTHBEAT_LLM_API_KEY'] || stored.apiKey || '',
    };
  }

  async publicView(): Promise<PublicSettings> {
    const s = await this.get();
    return { provider: s.provider, baseUrl: s.baseUrl, model: s.model, hasKey: !!s.apiKey, keyFromEnv: !!this.env['SOUTHBEAT_LLM_API_KEY'] };
  }

  /** apiKey: a new key, '' to remove it, undefined to keep the old one. */
  async update(input: { provider?: unknown; baseUrl?: unknown; model?: unknown; apiKey?: unknown }): Promise<PublicSettings> {
    const stored = await this.read();
    const provider: ProviderKind = input.provider === 'anthropic' ? 'anthropic' : 'openai';
    const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const baseUrl = text(input.baseUrl, 300);
    if (baseUrl && !/^https?:\/\/[^\s]+$/i.test(baseUrl)) throw new Error('Die Adresse muss mit http:// oder https:// beginnen.');
    const next: Partial<LlmSettings> = {
      provider,
      baseUrl,
      model: text(input.model, 100) || PROVIDER_DEFAULTS[provider].model,
      apiKey: input.apiKey === undefined || input.apiKey === null ? stored.apiKey : text(input.apiKey, 400),
    };
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(`${this.file}.tmp`, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
    await rename(`${this.file}.tmp`, this.file);
    await chmod(this.file, 0o600).catch(() => undefined);
    return this.publicView();
  }

  private async read(): Promise<Partial<LlmSettings>> {
    try {
      return JSON.parse(await readFile(this.file, 'utf8')) as Partial<LlmSettings>;
    } catch {
      return {};
    }
  }
}
