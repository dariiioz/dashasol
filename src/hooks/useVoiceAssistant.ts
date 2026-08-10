import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { defaultAssistantModel } from '../stores/config';
import { getHomeAssistantClient } from './useHomeAssistant';
import { configuredApiKey, OpenRouterClient, toolArguments, type ChatMessage } from '../services/openrouter/client';
import { controllableIds, houseDigest, systemPrompt, type HouseContext } from '../services/assistant/house';
import { assistantTools, isPlan, planCall, type ToolPlan } from '../services/assistant/tools';
import { listen, listeningBlocked, speak, stopSpeaking, type Listening } from '../services/assistant/speech';
/** One client for the whole application, reading the key at call time so a change in Réglages applies immediately. */
export const assistantClient = new OpenRouterClient(() => { const { assistant } = useAppStore.getState(); return { apiKey: configuredApiKey(assistant.apiKey), model: assistant.model?.trim() || defaultAssistantModel }; });
export const assistantConfigured = (apiKey?: string) => Boolean(configuredApiKey(apiKey));
export type AssistantPhase = 'idle' | 'listening' | 'thinking' | 'speaking';
/** A tool round trip costs a call: four rounds let the model act then confirm, without ever looping on the household's bill. */
const MAX_ROUNDS = 4;
/** Just enough memory for "et dans la chambre ?" to mean something, not enough to grow the prompt all day. */
const MEMORY = 6;
const houseContext = (): HouseContext => { const state = useAppStore.getState(); return { entities: state.entities, dashboard: state.dashboard, mapping: state.mapping, labels: state.labels, homeName: state.config?.homeName }; };
async function execute(plan: ToolPlan, demo: boolean) {
  if (demo) return `${plan.confirmation} (mode démonstration : rien n’a été envoyé à la maison)`;
  const client = getHomeAssistantClient();
  if (!client) throw new Error('Home Assistant n’est pas connecté.');
  await client.callService(plan.domain, plan.service, plan.data, { entity_id: plan.entityId });
  return plan.confirmation;
}
export function useVoiceAssistant() {
  const demo = useAppStore(s => s.demo); const assistant = useAppStore(s => s.assistant);
  const [phase, setPhase] = useState<AssistantPhase>('idle'); const [heard, setHeard] = useState(''); const [answer, setAnswer] = useState(''); const [error, setError] = useState<string>();
  const [actions, setActions] = useState<string[]>([]);
  const history = useRef<ChatMessage[]>([]); const session = useRef<Listening>(undefined); const abort = useRef<AbortController>(undefined);
  const configured = assistantConfigured(assistant.apiKey);
  const ask = useCallback(async (question: string) => {
    const asked = question.trim(); if (!asked) return;
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    setHeard(asked); setAnswer(''); setActions([]); setError(undefined); setPhase('thinking');
    const context = houseContext(); const allowed = controllableIds(context); const demoRun = useAppStore.getState().demo;
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt(houseDigest(context)) }, ...history.current, { role: 'user', content: asked }];
    const done: string[] = [];
    try {
      let reply = '';
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const turn = await assistantClient.chat(messages, assistantTools, controller.signal);
        if (!turn.toolCalls.length) { reply = turn.content; break; }
        messages.push({ role: 'assistant', content: turn.content, tool_calls: turn.toolCalls });
        for (const call of turn.toolCalls) {
          const outcome = planCall(call.function.name, toolArguments(call), allowed);
          /** Whatever happens — refusal, rejection by Home Assistant — the model is told, so it can say it out loud. */
          let result: string;
          if (!isPlan(outcome)) result = outcome.error;
          else try { result = await execute(outcome, demoRun); done.push(result); setActions([...done]); }
          catch (failure) { result = `Home Assistant a refusé : ${failure instanceof Error ? failure.message : 'commande impossible'}.`; }
          messages.push({ role: 'tool', tool_call_id: call.id, content: result });
        }
        if (round === MAX_ROUNDS - 1) reply = turn.content || done.join(' ');
      }
      if (controller.signal.aborted) return;
      const spoken = reply || done.join(' ') || 'Je n’ai pas de réponse à donner.';
      const exchange: ChatMessage[] = [{ role: 'user', content: asked }, { role: 'assistant', content: spoken }];
      history.current = [...history.current, ...exchange].slice(-MEMORY);
      setAnswer(spoken);
      if (useAppStore.getState().assistant.voice !== false) { setPhase('speaking'); speak(spoken, () => setPhase(current => current === 'speaking' ? 'idle' : current)); }
      else setPhase('idle');
    } catch (failure) {
      if (controller.signal.aborted || (failure instanceof DOMException && failure.name === 'AbortError')) return;
      setError(failure instanceof Error ? failure.message : 'L’assistant n’a pas pu répondre.'); setPhase('idle');
    }
  }, []);
  const start = useCallback(() => {
    stopSpeaking(); setError(undefined); setHeard(''); setAnswer(''); setActions([]); setPhase('listening');
    const active = listen(setHeard); session.current = active;
    /** An empty dictation used to return to idle without a word: the household could not tell a silent microphone from a broken assistant. */
    void active.transcript.then(text => { session.current = undefined; if (!text) { setError('Aucune parole n’a été captée. Réessayez, ou écrivez votre demande.'); setPhase('idle'); return; } void ask(text); })
      .catch((failure: Error) => { session.current = undefined; setError(failure.message); setPhase('idle'); });
  }, [ask]);
  /** Tapping the microphone again means "I have finished speaking", not "forget it": the dictation is closed, then sent. */
  const stop = useCallback(() => { session.current?.stop(); }, []);
  const cancel = useCallback(() => { session.current?.cancel(); session.current = undefined; abort.current?.abort(); stopSpeaking(); setPhase('idle'); }, []);
  const forget = useCallback(() => { history.current = []; setHeard(''); setAnswer(''); setActions([]); setError(undefined); }, []);
  useEffect(() => () => { session.current?.cancel(); abort.current?.abort(); stopSpeaking(); }, []);
  const blocked = listeningBlocked();
  return { phase, heard, answer, actions, error, ask, start, stop, cancel, forget, configured, demo, blocked, canListen: !blocked };
}
