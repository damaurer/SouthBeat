import Anthropic from '@anthropic-ai/sdk';

/** Which kind of API the studio talks to. */
export type ProviderKind = 'openai' | 'anthropic';

export interface LlmSettings {
  provider: ProviderKind;
  /** For 'openai': any OpenAI-compatible server, e.g. http://localhost:11434/v1 for Ollama. */
  baseUrl: string;
  model: string;
  /** Empty for local servers that need none. Never sent to browsers. */
  apiKey: string;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

/** One answer of the model: text for the user and the tools it wants to use. */
export interface Turn {
  text: string;
  toolCalls: ToolCall[];
}

/**
 * A running conversation. It keeps the provider's own message format, appends only, and
 * hands back what the model said; the studio agent decides what happens with tool calls.
 */
export interface Conversation {
  say(text: string): Promise<Turn>;
  answerTools(results: { id: string; name: string; output: string }[]): Promise<Turn>;
}

export function startConversation(settings: LlmSettings, system: string, tools: ToolDef[]): Conversation {
  return settings.provider === 'anthropic' ? new AnthropicConversation(settings, system, tools) : new OpenAiConversation(settings, system, tools);
}

export class LlmError extends Error {}

// ---------- Anthropic (official SDK) ----------

/** Models that take server-side refusal fallbacks and effort settings. */
const FALLBACK_MODELS = ['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5'];

class AnthropicConversation implements Conversation {
  private client: Anthropic | null = null;
  private readonly messages: Anthropic.Beta.BetaMessageParam[] = [];

  constructor(
    private readonly settings: LlmSettings,
    private readonly system: string,
    private readonly tools: ToolDef[],
  ) {}

  say(text: string): Promise<Turn> {
    this.messages.push({ role: 'user', content: text });
    return this.run();
  }

  answerTools(results: { id: string; name: string; output: string }[]): Promise<Turn> {
    // All results of one turn go back in a single message.
    this.messages.push({ role: 'user', content: results.map((r) => ({ type: 'tool_result' as const, tool_use_id: r.id, content: r.output })) });
    return this.run();
  }

  private async run(): Promise<Turn> {
    const model = this.settings.model || 'claude-opus-5-5';
    const modern = FALLBACK_MODELS.includes(model);
    let response: Anthropic.Beta.BetaMessage;
    try {
      // Without a key here the SDK uses ANTHROPIC_API_KEY or a stored `ant auth login` profile.
      this.client ??= new Anthropic({
        ...(this.settings.apiKey ? { apiKey: this.settings.apiKey } : {}),
        ...(this.settings.baseUrl ? { baseURL: this.settings.baseUrl } : {}),
        timeout: 5 * 60_000,
      });
      response = await this.client.beta.messages.create({
        model,
        max_tokens: 16000,
        system: this.system,
        tools: this.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema })),
        messages: this.messages,
        ...(modern ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const, output_config: { effort: 'medium' as const } } : {}),
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) throw new LlmError('Anthropic lehnt den API-Key ab, oder es ist keiner hinterlegt. Bitte in den Einstellungen prüfen.');
      if (error instanceof Anthropic.NotFoundError) throw new LlmError(`Das Modell "${model}" kennt Anthropic nicht. Bitte in den Einstellungen prüfen.`);
      if (error instanceof Anthropic.RateLimitError) throw new LlmError('Anthropic meldet zu viele Anfragen. Bitte kurz warten.');
      // The connection error is a subclass of APIError in this SDK, so it is checked first.
      if (error instanceof Anthropic.APIConnectionError) throw new LlmError('Anthropic ist nicht erreichbar.');
      if (error instanceof Anthropic.APIError) throw new LlmError(`Anthropic-Fehler ${error.status ?? ''}: ${error.message}`);
      throw new LlmError(`Anthropic: ${(error as Error).message}`);
    }
    // The whole content goes back into the history unchanged (thinking blocks included).
    this.messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'refusal') {
      throw new LlmError('Das Modell hat diese Anfrage abgelehnt. Formuliere den Wunsch anders.');
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    const toolCalls = response.content
      .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, input: b.input }));
    return { text, toolCalls };
  }
}

// ---------- OpenAI-compatible (OpenAI, Ollama, LM Studio, llama.cpp, vLLM, ...) ----------

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

class OpenAiConversation implements Conversation {
  private readonly messages: ChatMessage[];
  /** Some local servers reject tools; then the model answers with a JSON block instead. */
  private useTools = true;

  constructor(
    private readonly settings: LlmSettings,
    system: string,
    private readonly tools: ToolDef[],
  ) {
    this.messages = [{ role: 'system', content: system }];
  }

  say(text: string): Promise<Turn> {
    this.messages.push({ role: 'user', content: text });
    return this.run();
  }

  answerTools(results: { id: string; name: string; output: string }[]): Promise<Turn> {
    for (const r of results) this.messages.push({ role: 'tool', tool_call_id: r.id, content: r.output });
    return this.run();
  }

  private async run(): Promise<Turn> {
    const base = (this.settings.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const body = (withTools: boolean): string =>
      JSON.stringify({
        model: this.settings.model,
        messages: this.messages,
        ...(withTools ? { tools: this.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })), tool_choice: 'auto' } : {}),
      });
    const post = (withTools: boolean): Promise<Response> =>
      fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(this.settings.apiKey ? { Authorization: `Bearer ${this.settings.apiKey}` } : {}) },
        body: body(withTools),
        signal: AbortSignal.timeout(5 * 60_000),
      });
    let res: Response;
    try {
      res = await post(this.useTools);
      if (!res.ok && this.useTools && res.status === 400 && /tool/i.test(await res.clone().text())) {
        this.useTools = false;
        this.messages.push({ role: 'system', content: 'Dieser Server kann keine Werkzeuge aufrufen. Gib das fertige Paket als ```json Codeblock in deiner Antwort aus.' });
        res = await post(false);
      }
    } catch (error) {
      throw new LlmError(`Der LLM-Server unter ${base} ist nicht erreichbar (${(error as Error).message}). Läuft er, und stimmt die Adresse?`);
    }
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new LlmError(res.status === 401 || res.status === 403 ? 'Der LLM-Server lehnt den API-Key ab.' : `LLM-Server antwortet mit ${res.status}: ${detail}`);
    }
    const json = (await res.json()) as { choices?: { message?: ChatMessage }[] };
    const message = json.choices?.[0]?.message;
    if (!message) throw new LlmError('Der LLM-Server hat keine Antwort geliefert.');
    this.messages.push({ role: 'assistant', content: message.content ?? '', ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}) });
    const toolCalls = (message.tool_calls ?? []).map((c) => {
      let input: unknown = null;
      try {
        input = JSON.parse(c.function.arguments || '{}');
      } catch {
        input = { __invalid: c.function.arguments };
      }
      return { id: c.id, name: c.function.name, input };
    });
    return { text: message.content ?? '', toolCalls };
  }
}
