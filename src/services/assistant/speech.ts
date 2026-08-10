/** Minimal shape of the Web Speech API: the standard lib does not type it, and Safari still ships it prefixed. */
interface RecognitionAlternative { transcript: string }
interface RecognitionResult { isFinal: boolean; 0: RecognitionAlternative }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface RecognitionErrorEvent { error: string }
interface Recognition { lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number; start(): void; stop(): void; abort(): void; onresult: ((event: RecognitionEvent) => void) | null; onerror: ((event: RecognitionErrorEvent) => void) | null; onend: (() => void) | null }
type RecognitionConstructor = new () => Recognition;
const constructor = (): RecognitionConstructor | undefined => (window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: RecognitionConstructor }).webkitSpeechRecognition;
/** `localhost` and `127.0.0.1` are secure contexts, a LAN address in plain HTTP is not: the browser then refuses the microphone whatever the user allows. */
export const listeningBlocked = (): string | undefined => !constructor() ? 'Ce navigateur ne sait pas dicter : écrivez votre demande ci-dessous.' : !window.isSecureContext ? `Le micro exige une adresse sécurisée. ${window.location.hostname} est servi en HTTP : passez en HTTPS, ou ouvrez Sillage sur localhost. Écrivez votre demande en attendant.` : undefined;
export const listeningAvailable = () => !listeningBlocked();
export const speakingAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
const errors: Record<string, string> = { 'not-allowed': 'Le micro est refusé : autorisez-le dans les réglages du navigateur.', 'service-not-allowed': 'Le micro est refusé : autorisez-le dans les réglages du navigateur.', 'audio-capture': 'Aucun micro n’a été trouvé sur cet appareil.', 'no-speech': 'Je n’ai rien entendu. Parlez juste après avoir appuyé, puis réessayez.', 'language-not-supported': 'Ce navigateur ne sait pas dicter en français.', network: 'La reconnaissance vocale est injoignable : elle transcrit en ligne et le réseau n’a pas répondu.' };
export interface Listening { transcript: Promise<string>; stop: () => void; cancel: () => void }
/** One dictation, ended by silence or by the user. Resolves with the empty string when nothing was said or when cancelled. */
export function listen(onPartial?: (text: string) => void, lang = 'fr-FR'): Listening {
  const Recognizer = constructor();
  if (!Recognizer) return { transcript: Promise.reject(new Error('La dictée vocale n’est pas disponible sur ce navigateur.')), stop: () => {}, cancel: () => {} };
  const recognition = new Recognizer(); recognition.lang = lang; recognition.continuous = false; recognition.interimResults = true; recognition.maxAlternatives = 1;
  let final = ''; let failure: Error | undefined; let cancelled = false;
  const transcript = new Promise<string>((resolve, reject) => {
    recognition.onresult = event => { let interim = ''; for (let index = event.resultIndex; index < event.results.length; index += 1) { const result = event.results[index]!; if (result.isFinal) final += result[0].transcript; else interim += result[0].transcript; } onPartial?.((final + interim).trim()); };
    /** Only a deliberate cancel is silent. Anything else must be said out loud, code included: a dictation that fails mutely is indistinguishable from a broken assistant. */
    recognition.onerror = event => { if (event.error !== 'aborted') failure = new Error(errors[event.error] ?? `La dictée vocale s’est interrompue (${event.error}).`); };
    recognition.onend = () => { if (failure) reject(failure); else resolve(cancelled ? '' : final.trim()); };
  });
  try { recognition.start(); } catch { /* Starting twice throws; the running recognition already serves this request. */ }
  return { transcript, stop: () => recognition.stop(), cancel: () => { cancelled = true; recognition.abort(); } };
}
export const stopSpeaking = () => { if (speakingAvailable()) window.speechSynthesis.cancel(); };
/** Reads the answer out loud. A missing French voice is not worth refusing to speak: the default voice still says it. */
export function speak(text: string, onEnd?: () => void, lang = 'fr-FR') {
  if (!speakingAvailable() || !text.trim()) { onEnd?.(); return; }
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(text); utterance.lang = lang; utterance.rate = 1;
  const voice = window.speechSynthesis.getVoices().find(candidate => candidate.lang.replace('_', '-').toLowerCase().startsWith(lang.slice(0, 2)));
  if (voice) utterance.voice = voice;
  utterance.onend = () => onEnd?.(); utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}
