import { useEffect, useRef } from 'react';
/**
 * Drives the dial from the words the recogniser actually returns, not from a second microphone stream.
 * A `getUserMedia` analyser running next to `SpeechRecognition` competes for the same input — the dial danced
 * while the dictation captured nothing — and it costs a second permission prompt on a wall tablet.
 * The level is written straight onto the element: this runs at 60 images per second and must never re-render React.
 */
export function useVoicePulse(active: boolean, signal: string) {
  const target = useRef<HTMLDivElement>(null); const struck = useRef(0);
  useEffect(() => { struck.current = Date.now(); }, [signal]);
  useEffect(() => {
    const element = target.current;
    if (!active || !element) return;
    let frame = 0;
    const draw = () => {
      const since = Date.now() - struck.current;
      /** Each burst of words strikes the dial, then it falls back — while a slow sway keeps it alive before the first word. */
      const impulse = Math.max(0, 1 - since / 900);
      const sway = 0.17 + 0.09 * Math.sin(Date.now() / 430);
      element.style.setProperty('--level', (sway + impulse * 0.7).toFixed(3));
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(frame); element.style.setProperty('--level', '0'); };
  }, [active]);
  return target;
}
