export interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
export interface ChatMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: ToolCall[]; tool_call_id?: string }
export interface ToolSchema { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }
export interface ChatReply { content: string; toolCalls: ToolCall[] }
export class OpenRouterError extends Error { constructor(readonly status: number, message: string) { super(message); } }
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const message = (status: number, detail?: string) => status === 401 ? 'La clé OpenRouter a été refusée.' : status === 402 ? 'Le crédit OpenRouter est épuisé.' : status === 404 ? 'Ce modèle est introuvable sur OpenRouter.' : status === 429 ? 'Trop de demandes : laissez passer quelques secondes.' : status === 0 ? 'OpenRouter est injoignable.' : detail ?? 'OpenRouter n’a pas répondu correctement.';
/** The environment variable is the fallback: a key baked at build time works even on a freshly wiped device. */
export const configuredApiKey = (stored?: string) => (stored ?? '').trim() || import.meta.env.VITE_OPENROUTER_API_KEY || '';
/** Thin wrapper over the OpenRouter chat completions API. Credentials are read per call and never logged. */
export class OpenRouterClient {
  constructor(private credentials: () => { apiKey: string; model: string }) {}
  async chat(messages: ChatMessage[], tools: ToolSchema[] = [], signal?: AbortSignal): Promise<ChatReply> {
    const { apiKey, model } = this.credentials();
    if (!apiKey) throw new OpenRouterError(401, 'Aucune clé OpenRouter enregistrée.');
    let response: Response;
    /** A wall tablet loses its network regularly: a dropped fetch must read like every other OpenRouter failure. */
    try { response = await fetch(ENDPOINT, { method: 'POST', signal, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'Sillage' }, body: JSON.stringify({ model, messages, temperature: 0.2, ...(tools.length ? { tools, tool_choice: 'auto' } : {}) }) }); }
    catch (failure) { throw failure instanceof DOMException && failure.name === 'AbortError' ? failure : new OpenRouterError(0, message(0)); }
    const payload = await response.json().catch(() => undefined) as { error?: { message?: string }; choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] } | undefined;
    if (!response.ok) throw new OpenRouterError(response.status, message(response.status, payload?.error?.message));
    const answer = payload?.choices?.[0]?.message;
    /** OpenRouter answers 200 with an error body when the upstream provider fails: that is still a failure. */
    if (!answer) throw new OpenRouterError(response.status, message(response.status, payload?.error?.message));
    return { content: (answer.content ?? '').trim(), toolCalls: (answer.tool_calls ?? []).filter(call => call?.function?.name) };
  }
}
/** Models answer with a JSON string whose shape is never guaranteed: a malformed call must not crash the turn. */
export const toolArguments = (call: ToolCall): Record<string, unknown> => { try { const parsed = JSON.parse(call.function.arguments || '{}') as unknown; return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; } };
