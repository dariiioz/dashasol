import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { eufyHeaders } from '../../services/eufy/client';
import { bufferTarget, playbackWindow } from '../../services/eufy/playback';
export function EufyLiveVideo({ close }: { close: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState('Ouverture de la vidéo…'); const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let url: string | undefined; let stopped = false;
    const element = video.current!;
    let started = false; let buffering = true; let userPaused = false; let internalPause = false;
    let playPending = false; let ended = false; let fatal = false; let stalls = 0; let lastSeek = 0;
    const deadline = window.setTimeout(() => controller.abort(), 90000);
    const until = (target: EventTarget, name: string) => new Promise<void>((resolve, reject) => {
      const cleanup = () => { target.removeEventListener(name, ready); target.removeEventListener('error', fail); controller.signal.removeEventListener('abort', fail); };
      const ready = () => { cleanup(); resolve(); }; const fail = () => { cleanup(); reject(new Error('La lecture vidéo a été interrompue.')); };
      target.addEventListener(name, ready, { once: true }); target.addEventListener('error', fail, { once: true }); controller.signal.addEventListener('abort', fail, { once: true }); if (controller.signal.aborted) fail();
    });
    const windowAhead = () => playbackWindow(Array.from({ length: element.buffered.length }, (_, index) => ({ start: element.buffered.start(index), end: element.buffered.end(index) })), element.currentTime, buffering && started);
    const maintain = () => {
      if (stopped || fatal || userPaused || playPending) return;
      const window = windowAhead();
      element.dataset.bufferSeconds = window.ahead.toFixed(2);
      element.dataset.rebuffers = String(stalls);
      const quality = element.getVideoPlaybackQuality?.();
      if (quality) { element.dataset.decodedFrames = String(quality.totalVideoFrames); element.dataset.droppedFrames = String(quality.droppedVideoFrames); }
      if (buffering) {
        // Start with a reserve, not at the instant the first frame is decodable.
        if (window.ahead < (ended ? .05 : bufferTarget(stalls))) return;
        if (window.position > element.currentTime + .02) element.currentTime = window.position;
        buffering = false; started = true; playPending = true; setMessage('');
        void element.play().catch(error => {
          if (stopped) return;
          if (error instanceof DOMException && error.name === 'AbortError') { buffering = true; setMessage('Préparation d’une lecture fluide…'); return; }
          userPaused = true; setMessage('Appuie sur lecture pour afficher la vidéo.');
        }).finally(() => { playPending = false; });
      } else if (!element.paused && !element.seeking) {
        if (window.position > element.currentTime + .08) element.currentTime = window.position;
        // Recover a very old live edge once, without continually speeding up/slowing down.
        if (!ended && window.ahead > 15 && Date.now() - lastSeek > 10000) {
          element.currentTime = window.end - bufferTarget(stalls); lastSeek = Date.now();
        }
      }
    };
    const waiting = () => {
      if (!started || buffering || playPending || userPaused || ended || stopped || element.seeking || windowAhead().ahead > .25) return;
      buffering = true; stalls++; internalPause = !element.paused;
      element.pause(); setMessage('Stabilisation de la vidéo…');
    };
    const paused = () => { if (internalPause) { internalPause = false; return; } if (started && !ended && !stopped) userPaused = true; };
    const playing = () => { userPaused = false; buffering = false; started = true; setMessage(''); };
    element.addEventListener('waiting', waiting); element.addEventListener('pause', paused); element.addEventListener('playing', playing);
    const timer = window.setInterval(maintain, 250);
    const read = async () => {
      try {
        const Constructor = window.MediaSource ?? (window as unknown as { ManagedMediaSource?: typeof MediaSource }).ManagedMediaSource;
        if (!Constructor) throw new Error('Ce navigateur ne prend pas en charge ce lecteur vidéo.');
        const response = await fetch('/api/eufy/live', { headers: eufyHeaders, credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok || !response.body) { const result = await response.json().catch(() => undefined); throw new Error(result?.error || 'Vidéo Eufy indisponible.'); }
        const mime = response.headers.get('Content-Type') || '';
        if (!mime.startsWith('video/mp4') || !Constructor.isTypeSupported(mime)) throw new Error('Le format vidéo de la sonnette n’est pas pris en charge par ce navigateur.');
        const source = new Constructor(); url = URL.createObjectURL(source); element.src = url;
        await until(source, 'sourceopen'); if (stopped) return;
        const buffer = source.addSourceBuffer(mime); const reader = response.body.getReader();
        const update = async (action: () => void) => {
          const completed = until(buffer, 'updateend');
          try { action(); await completed; } catch (error) { void completed.catch(() => {}); throw error; }
        };
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read(); if (done) break;
          await update(() => buffer.appendBuffer(value.slice().buffer));
          if (!started) setMessage('Préparation d’une lecture fluide…');
          maintain();
          if (element.currentTime > 25 && buffer.buffered.length && buffer.buffered.start(0) < element.currentTime - 20) {
            await update(() => buffer.remove(0, element.currentTime - 15));
          }
        }
        if (!stopped) {
          ended = true; if (source.readyState === 'open') source.endOfStream();
          maintain(); setMessage('Direct terminé · durée limitée à une minute.');
        }
      } catch (failure) {
        if (!stopped) { fatal = true; setFailed(true); setMessage(failure instanceof Error ? failure.message : 'Vidéo interrompue.'); }
      } finally { controller.abort(); }
    };
    const visibility = () => { if (document.visibilityState === 'hidden') close(); }; document.addEventListener('visibilitychange', visibility);
    void read();
    return () => {
      stopped = true; controller.abort(); clearTimeout(deadline); clearInterval(timer);
      element.removeEventListener('waiting', waiting); element.removeEventListener('pause', paused); element.removeEventListener('playing', playing);
      document.removeEventListener('visibilitychange', visibility);
      element.pause(); element.removeAttribute('src'); element.load(); if (url) URL.revokeObjectURL(url);
    };
  }, [close]);
  return <div className="entry-live"><video ref={video} muted playsInline controls aria-label="Vidéo en direct de la sonnette Eufy" onError={() => { setFailed(true); setMessage('Le navigateur ne peut pas décoder ce flux. Ferme puis relance le direct.'); }} />{message && <p className={failed ? 'error' : ''} role="status">{message}</p>}<button className="entry-live-close" onClick={close} aria-label="Arrêter le direct"><X size={17} />Arrêter</button></div>;
}
