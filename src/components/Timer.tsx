import { useEffect, useState } from 'react';
import { Timer, Pause, Play, RotateCcw } from 'lucide-react';
import { QuickDrawer } from './QuickDrawer';
import { timerTime, useTimerStore } from '../stores/timerStore';

let audio: AudioContext | undefined;
function enableSound() {
  try { audio ??= new AudioContext(); void audio.resume().catch(() => {}); } catch { /* Audio is optional on unsupported browsers. */ }
}
function ring() {
  if (!audio || audio.state !== 'running') return;
  for (let i = 0; i < 3; i++) {
    const oscillator = audio.createOscillator(); const gain = audio.createGain();
    const start = audio.currentTime + i * .45;
    oscillator.frequency.value = 880; gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(.18, start + .02); gain.gain.exponentialRampToValueAtTime(.001, start + .3);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + .32);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
export function TimerButton() {
  const remaining = useTimerStore(s => s.remaining);
  const active = useTimerStore(s => s.deadline !== null || s.paused || s.finished);
  const finished = useTimerStore(s => s.finished);
  return <button className="home-timer-button" aria-label="Ouvrir le minuteur" data-active={active} onClick={() => useTimerStore.setState({ open: true })}><Timer size={18} /><span>Minuteur</span><b>{finished ? 'Terminé' : active ? timerTime(remaining) : 'Régler'}</b></button>;
}
export function TimerHost() {
  const timer = useTimerStore();
  useEffect(() => {
    const tick = () => useTimerStore.getState().tick();
    tick(); const interval = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick); window.addEventListener('focus', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); };
  }, []);
  useEffect(() => { if (timer.finished) { ring(); useTimerStore.setState({ open: true }); } }, [timer.finished]);
  if (!timer.open) return null;
  return <QuickDrawer title="Minuteur" placement="bottom" onClose={() => useTimerStore.setState({ open: false })}><TimerControls /></QuickDrawer>;
}
function TimerControls() {
  const timer = useTimerStore();
  const [minutes, setMinutes] = useState(String(Math.floor(timer.duration / 60)));
  const [seconds, setSeconds] = useState(String(timer.duration % 60));
  const active = timer.deadline !== null || timer.paused;
  const duration = Number(minutes) * 60 + Number(seconds);
  const valid = /^\d{1,4}$/.test(minutes) && /^\d{1,2}$/.test(seconds) && Number(seconds) < 60 && duration > 0 && duration <= 86399;
  const start = (value: number) => { enableSound(); timer.start(value); };
  return <div className="timer-panel">
    <p className="timer-status" role="status">{timer.finished ? 'Le temps est écoulé !' : timer.deadline ? 'En cours' : active ? 'En pause' : 'Prêt à démarrer'}</p>
    <div className="timer-countdown" role="timer" aria-label="Temps restant">{timerTime(timer.remaining)}</div>
    {!active && !timer.finished && <><div className="timer-presets">{[1, 3, 5, 10, 15, 30].map(value => <button key={value} onClick={() => start(value * 60)}>{value} min</button>)}</div><form onSubmit={event => { event.preventDefault(); if (valid) start(duration); }}><div className="timer-inputs"><label>Minutes<input type="text" inputMode="numeric" maxLength={4} value={minutes} onChange={event => setMinutes(event.target.value)} /></label><span>:</span><label>Secondes<input type="text" inputMode="numeric" maxLength={2} value={seconds} onChange={event => setSeconds(event.target.value)} /></label></div><button className="timer-primary" disabled={!valid} type="submit"><Play size={18} />Démarrer</button></form></>}
    {active && !timer.finished && <div className="timer-actions"><button className="timer-primary" onClick={() => { enableSound(); if (timer.deadline) timer.pause(); else timer.resume(); }}>{timer.deadline ? <Pause size={18} /> : <Play size={18} />}{timer.deadline ? 'Pause' : 'Reprendre'}</button><button onClick={timer.reset}><RotateCcw size={18} />Annuler</button></div>}
    {timer.finished && <div className="timer-actions"><button className="timer-primary" onClick={() => start(timer.duration)}><RotateCcw size={18} />Relancer</button><button onClick={timer.reset}>Terminer</button></div>}
    <p className="timer-note">Le signal sonore nécessite de garder l’application ouverte. En veille, l’alerte apparaît au retour.</p>
  </div>;
}
