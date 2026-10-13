import { randomUUID } from 'node:crypto';
import { ContentPack, cleanPack, contentReference, installedContent, packErrors, takenIds } from '../../app/content/content';
import { contentPackSchema } from '../../app/content/content-schema';
import { Conversation, LlmError, LlmSettings, ToolCall, ToolDef, startConversation } from './llm';

/** What the studio shows after each message: the model's words and, once it has one, the draft. */
export interface StudioReply {
  sessionId: string;
  text: string;
  draft: ContentPack | null;
  /** What is still wrong with the draft, if the model gave up before fixing it. */
  errors: string[];
  /** Short log of what the agent did, for the user to follow along. */
  steps: string[];
}

const MAX_ROUNDS = 8;
const SESSION_TTL_MS = 60 * 60_000;
const MAX_SESSIONS = 30;

const TOOLS: ToolDef[] = [
  {
    name: 'get_reference',
    description: 'Liefert die Spielwerte: vorhandene Moves mit Werten, Arenen, vergebene IDs, Balance-Regeln und erlaubte Aussehen-Werte.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'validate_pack',
    description: 'Prüft ein Inhaltspaket gegen Schema und Balance-Regeln. Gibt "OK" oder eine Liste von Fehlern zurück. Nutze es, bevor du ein Paket einreichst.',
    parameters: { type: 'object', properties: { pack: { type: 'object', description: 'Das komplette Inhaltspaket' } }, required: ['pack'], additionalProperties: false },
  },
  {
    name: 'submit_pack',
    description: 'Reicht das fertige Paket ein. Es wird geprüft und bei Erfolg dem Nutzer als Vorschau gezeigt; gespeichert wird erst, wenn der Nutzer es bestätigt.',
    parameters: { type: 'object', properties: { pack: { type: 'object', description: 'Das komplette Inhaltspaket' } }, required: ['pack'], additionalProperties: false },
  },
];

function systemPrompt(): string {
  return [
    'Du bist der Content-Designer im Content-Studio von SouthBeat. Du baust aus den Wünschen des Nutzers Inhaltspakete: neue Moves (Attacken), Arenen, Kämpfer und Bonus-Gegner.',
    '',
    'So arbeitest du:',
    '1. Verstehe den Wunsch. Fehlen Details, triff selbst passende Entscheidungen im Büro- und Programmierer-Humor des Spiels, statt nachzufragen.',
    '2. Baue ein vollständiges Paket nach dem Schema unten. Für Bonus-Gegner und Kämpfer mit eigener Signatur-Attacke legst du die Moves im selben Paket an (exclusive: true).',
    '3. Rufe validate_pack auf und behebe alle gemeldeten Fehler, bis es "OK" meldet. Halte dich an die Balance-Regeln, statt sie zu umgehen.',
    '4. Rufe submit_pack mit dem fertigen Paket auf.',
    '5. Antworte danach kurz auf Deutsch: was du gebaut hast und wie es sich spielt. Wiederhole nicht das JSON.',
    '',
    'Wenn der Nutzer Änderungen an der Vorschau wünscht, ändere das Paket und reiche es erneut ein. Behalte dabei die id des Pakets.',
    'Texte (Namen, Sprüche, Beschreibungen) schreibst du auf Deutsch. IDs sind kleingeschrieben mit Bindestrichen.',
    '',
    '## Spielwerte und Regeln',
    contentReference(),
    '',
    '## JSON-Schema eines Inhaltspakets',
    JSON.stringify(contentPackSchema()),
  ].join('\n');
}

interface Session {
  conversation: Conversation;
  draft: ContentPack | null;
  touched: number;
}

/**
 * The content studio's agent. The model writes packs; the game's own rules check them
 * through tools, and the errors go back to the model until the pack passes. Nothing is
 * saved here: the user sees a preview and decides.
 */
export class StudioAgent {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly settings: () => Promise<LlmSettings>) {}

  async chat(sessionId: string | null, message: string): Promise<StudioReply> {
    this.sweep();
    let id = sessionId && this.sessions.has(sessionId) ? sessionId : null;
    if (!id) {
      if (this.sessions.size >= MAX_SESSIONS) throw new LlmError('Gerade laufen zu viele Studio-Gespräche. Bitte später noch mal.');
      id = randomUUID();
      this.sessions.set(id, { conversation: startConversation(await this.settings(), systemPrompt(), TOOLS), draft: null, touched: Date.now() });
    }
    const session = this.sessions.get(id)!;
    session.touched = Date.now();
    const steps: string[] = [];
    let lastErrors: string[] = [];
    let turn = await session.conversation.say(message);
    for (let round = 0; turn.toolCalls.length > 0 && round < MAX_ROUNDS; round++) {
      const results = turn.toolCalls.map((call) => {
        const { output, errors, accepted } = this.runTool(call, session);
        steps.push(stepLabel(call, errors, accepted));
        if (call.name !== 'get_reference') lastErrors = errors;
        return { id: call.id, name: call.name, output };
      });
      turn = await session.conversation.answerTools(results);
    }
    // Models without tool calls (some local ones) put the pack into a JSON block instead.
    const inline = extractJson(turn.text);
    if (inline) {
      const errors = packErrors(inline, takenIds(inline.id));
      steps.push(errors.length === 0 ? 'Paket aus der Antwort gelesen' : `Paket aus der Antwort gelesen, ${errors.length} Fehler`);
      if (errors.length === 0) session.draft = cleanPack(inline);
      lastErrors = errors;
    }
    return { sessionId: id, text: stripJson(turn.text).trim(), draft: session.draft, errors: session.draft && lastErrors.length === 0 ? [] : lastErrors, steps };
  }

  forget(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private runTool(call: ToolCall, session: Session): { output: string; errors: string[]; accepted: boolean } {
    if (call.name === 'get_reference') {
      return { output: `${contentReference()}\n\nInstallierte Pakete: ${installedContent().map((p) => p.id).join(', ') || 'keine'}`, errors: [], accepted: false };
    }
    if (call.name !== 'validate_pack' && call.name !== 'submit_pack') {
      return { output: `Unbekanntes Werkzeug ${call.name}.`, errors: [], accepted: false };
    }
    const pack = (call.input as { pack?: ContentPack } | null)?.pack;
    if (!pack || typeof pack !== 'object') {
      const errors = ['Das Argument "pack" fehlt oder ist kein JSON-Objekt.'];
      return { output: errors[0], errors, accepted: false };
    }
    const errors = packErrors(pack, takenIds(pack.id));
    if (errors.length > 0) return { output: `Fehler:\n- ${errors.join('\n- ')}`, errors, accepted: false };
    if (call.name === 'validate_pack') return { output: 'OK', errors, accepted: false };
    session.draft = cleanPack(pack);
    return { output: 'Eingereicht. Der Nutzer sieht jetzt die Vorschau und entscheidet, ob es ins Spiel kommt.', errors, accepted: true };
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, s] of this.sessions) if (now - s.touched > SESSION_TTL_MS) this.sessions.delete(id);
  }
}

function stepLabel(call: ToolCall, errors: string[], accepted: boolean): string {
  if (call.name === 'get_reference') return 'Spielwerte nachgeschlagen';
  if (call.name === 'validate_pack') return errors.length ? `Prüfung: ${errors.length} Fehler, wird korrigiert` : 'Prüfung bestanden';
  if (call.name === 'submit_pack') return accepted ? 'Paket eingereicht' : `Einreichung abgelehnt: ${errors.length} Fehler`;
  return call.name;
}

const JSON_BLOCK = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;

function extractJson(text: string): ContentPack | null {
  const match = JSON_BLOCK.exec(text);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]);
    return value && typeof value === 'object' && 'version' in value ? (value as ContentPack) : null;
  } catch {
    return null;
  }
}

function stripJson(text: string): string {
  return text.replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, '').replace(/\n{3,}/g, '\n\n');
}
