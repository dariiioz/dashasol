// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listen } from './speech';
type Handlers = { onresult: ((event: unknown) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null };
let recognizer: Handlers | undefined;
const stub = () => { vi.stubGlobal('SpeechRecognition', class { lang = ''; continuous = false; interimResults = false; maxAlternatives = 0; onresult: Handlers['onresult'] = null; onerror: Handlers['onerror'] = null; onend: Handlers['onend'] = null; constructor() { recognizer = this; } start() {} stop() {} abort() {} }); };
const result = (transcript: string, isFinal: boolean) => ({ resultIndex: 0, results: { length: 1, 0: { isFinal, 0: { transcript } } } });
afterEach(() => { vi.unstubAllGlobals(); recognizer = undefined; });
describe('dictation', () => {
  it('returns what was said once the recogniser settles', async () => { stub(); const partials: string[] = []; const session = listen(text => partials.push(text)); recognizer!.onresult!(result('ferme le volet', true)); recognizer!.onend!(); await expect(session.transcript).resolves.toBe('ferme le volet'); expect(partials).toEqual(['ferme le volet']); });
  /** The regression that made the assistant look broken: silence came back as an empty string and the interface said nothing at all. */
  it('says so when the recogniser heard nothing', async () => { stub(); const session = listen(); recognizer!.onerror!({ error: 'no-speech' }); recognizer!.onend!(); await expect(session.transcript).rejects.toThrow('Je n’ai rien entendu'); });
  it('names an unknown failure rather than failing mutely', async () => { stub(); const session = listen(); recognizer!.onerror!({ error: 'bad-grammar' }); recognizer!.onend!(); await expect(session.transcript).rejects.toThrow('(bad-grammar)'); });
  it('stays silent only when the household cancels', async () => { stub(); const session = listen(); session.cancel(); recognizer!.onerror!({ error: 'aborted' }); recognizer!.onend!(); await expect(session.transcript).resolves.toBe(''); });
  it('reports a refused microphone with something the household can act on', async () => { stub(); const session = listen(); recognizer!.onerror!({ error: 'not-allowed' }); recognizer!.onend!(); await expect(session.transcript).rejects.toThrow('autorisez-le'); });
});
