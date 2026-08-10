import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Mic, Send, Settings, Square, TriangleAlert, Volume2, VolumeX, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useVoicePulse } from '../../hooks/useVoicePulse';
import { assistantConfigured, useVoiceAssistant, type AssistantPhase } from '../../hooks/useVoiceAssistant';
import { AssistantInstrument } from './AssistantInstrument';
/** Two registers: the machine states the household reads at a glance, and the invitation it answers by speaking. */
const readouts: Record<AssistantPhase, string> = { idle: 'En veille', listening: 'Écoute', thinking: 'Analyse', speaking: 'Réponse' };
const invitations: Record<AssistantPhase, string> = { idle: 'Appuyez, puis parlez.', listening: 'Je vous écoute. Appuyez pour envoyer.', thinking: 'Je consulte la maison…', speaking: 'Je réponds.' };
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
/** Opens from the hero so the wall keeps showing the time and the weather until someone actually asks for something. */
export function VoiceAssistant() {
  const [open, setOpen] = useState(false); const configured = assistantConfigured(useAppStore(s => s.assistant.apiKey));
  /** The launcher is a fragment of the dial it opens: the same graduations, at rest, waiting to be spoken to. */
  return <><button className="assistant-launch" data-ready={configured} onClick={() => setOpen(true)}>
    <span className="launch-dial"><svg className="launch-rings" viewBox="0 0 44 44" aria-hidden="true" focusable="false"><circle className="launch-graduations" cx="22" cy="22" r="19" /><circle className="launch-hairline" cx="22" cy="22" r="13" /></svg><Mic size={15} strokeWidth={1.9} /></span>
    <span className="launch-label">Parler à la maison</span>
  </button>{open && <AssistantPanel configured={configured} onClose={() => setOpen(false)} />}</>;
}
function AssistantPanel({ configured, onClose }: { configured: boolean; onClose: () => void }) {
  const { phase, heard, answer, actions, error, ask, start, stop, cancel, forget, demo, canListen, blocked } = useVoiceAssistant();
  const setPage = useAppStore(s => s.setPage); const voice = useAppStore(s => s.assistant.voice) !== false; const setAssistant = useAppStore(s => s.setAssistant); const reducedMotion = useAppStore(s => s.preferences.reducedMotion);
  const [typed, setTyped] = useState(''); const [seconds, setSeconds] = useState(0); const busy = phase === 'thinking';
  const stage = useVoicePulse(phase === 'listening', heard);
  /** Closing must silence the microphone and the voice: a wall tablet left listening is exactly what nobody wants. */
  const close = () => { cancel(); onClose(); };
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); });
  useEffect(() => { if (phase !== 'listening') { setSeconds(0); return; } const started = Date.now(); const tick = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500); return () => window.clearInterval(tick); }, [phase]);
  const tap = () => phase === 'listening' ? stop() : phase === 'idle' ? start() : cancel();
  const submit = (event: React.FormEvent) => { event.preventDefault(); const question = typed.trim(); if (!question || busy) return; setTyped(''); void ask(question); };
  return <div className="modal-backdrop hud-backdrop" role="presentation" onMouseDown={close}><motion.section className="assistant-modal" role="dialog" aria-modal="true" aria-label="Assistant vocal" initial={{ opacity: 0, scale: .96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: .34, ease: [.16, 1, .3, 1] }} onMouseDown={event => event.stopPropagation()}>
    <button className="modal-close" onClick={close} aria-label="Fermer"><X /></button>
    <header className="hud-header"><p className="eyebrow">Sillage · Assistant</p><h2>Parlez à la maison</h2></header>
    {!configured ? <div className="assistant-invitation"><p>Aucune clé OpenRouter n’est enregistrée sur cet appareil. L’assistant a besoin d’un modèle pour comprendre vos demandes.</p><button className="primary" onClick={() => { onClose(); setPage('settings'); }}><Settings size={16} /> Ouvrir les Réglages</button></div> : <>
      <div className={`hud-stage ${phase} ${reducedMotion ? 'still' : ''}`} ref={stage}>
        <motion.div className="hud-instrument" initial={{ opacity: 0, scale: .86 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .55, delay: .08, ease: [.16, 1, .3, 1] }}>
          <AssistantInstrument />
          <button className="hud-trigger" onClick={tap} disabled={!canListen && phase === 'idle'} aria-label={invitations[phase]}>{phase === 'listening' ? <Square size={24} /> : <Mic size={28} />}</button>
        </motion.div>
        <p className="hud-readout"><b>{readouts[phase]}</b>{phase === 'listening' && <span>{clock(seconds)}</span>}{demo && <span>démonstration</span>}</p>
        <p className="hud-invitation">{invitations[phase]}</p>
        {heard && <p className="hud-heard">« {heard} »</p>}
      </div>
      <button className="hud-voice" onClick={() => setAssistant({ voice: !voice })} aria-label={voice ? 'Couper la voix' : 'Activer la voix'}>{voice ? <Volume2 size={15} /> : <VolumeX size={15} />} {voice ? 'Réponse lue à voix haute' : 'Réponse écrite seulement'}</button>
      {blocked && <p className="settings-note warning"><TriangleAlert size={16} /><span>{blocked}</span></p>}
      {answer && <motion.p className="assistant-answer" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{answer.split(' ').map((word, index) => <motion.span key={`${word}-${index}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: Math.min(index * .028, .7) }}>{word} </motion.span>)}</motion.p>}
      {actions.length > 0 && <ul className="assistant-actions">{actions.map((action, index) => <motion.li key={`${action}-${index}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .07 }}><Check size={14} /> {action}</motion.li>)}</ul>}
      {error && <p className="settings-note warning"><TriangleAlert size={16} /><span>{error}</span></p>}
      <form className="assistant-compose" onSubmit={submit}><input value={typed} onChange={event => setTyped(event.target.value)} placeholder="Ou écrivez : « ferme les volets du salon »" aria-label="Écrire une demande" autoComplete="off" /><button type="submit" disabled={!typed.trim() || busy} aria-label="Envoyer"><Send size={16} /></button></form>
      {(answer || heard) && <button className="assistant-forget" onClick={forget}>Nouvelle conversation</button>}
    </>}
  </motion.section></div>;
}
