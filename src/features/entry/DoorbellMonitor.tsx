import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { useEufy } from '../../hooks/useEufy';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useAppStore } from '../../stores/appStore';
import { useDoorbellStore } from '../../stores/doorbellStore';
import { EufyLiveVideo } from './EufyLiveVideo';

export function DoorbellMonitor() {
  const demo = useAppStore(s => s.demo);
  const { status } = useEufy(!demo, 3000);
  const open = useDoorbellStore(s => s.open); const openLive = useDoorbellStore(s => s.openLive); const closeLive = useDoorbellStore(s => s.closeLive);
  const armedAt = useRef(Date.now()); const seen = useRef(new Set<string>()); const lastRing = useRef(0);
  useEffect(() => {
    if (demo || status.phase !== 'connected' || !status.selected) { closeLive(); return; }
    const available = status.devices.some(device => device.sn === status.selected && device.liveAvailable);
    for (const event of [...status.events].reverse()) {
      if (seen.current.has(event.id)) continue;
      seen.current.add(event.id);
      if (event.kind !== 'doorbellPress' || event.deviceSn !== status.selected || !available || document.visibilityState === 'hidden') continue;
      const age = Date.now() - event.receivedAt;
      // Old activity must never wake the camera on startup or when returning to the tablet.
      if (event.receivedAt < armedAt.current || age < -5000 || age > 20000 || event.receivedAt - lastRing.current < 3000) continue;
      lastRing.current = event.receivedAt; openLive(true);
    }
    if (seen.current.size > 200) seen.current = new Set(status.events.map(event => event.id));
  }, [status, demo, openLive, closeLive]);
  useEffect(() => { if (document.visibilityState === 'hidden') closeLive(); }, [open, closeLive]);
  return open ? <DoorbellDialog /> : null;
}

function DoorbellDialog() {
  const dialog = useDialogFocus(); const ringing = useDoorbellStore(s => s.ringing); const close = useDoorbellStore(s => s.closeLive);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };
    window.addEventListener('keydown', escape);
    const timer = window.setTimeout(close, 75000);
    return () => { window.removeEventListener('keydown', escape); clearTimeout(timer); };
  }, [close]);
  return createPortal(<div className="modal-backdrop doorbell-live-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section ref={dialog} className="home-doorbell-dialog" role="dialog" aria-modal="true" aria-label="Sonnette en direct" tabIndex={-1}>{ringing && <div className="doorbell-ring-caption" role="status"><Bell size={17} />Quelqu’un a sonné</div>}<EufyLiveVideo close={close} /></section></div>, document.body);
}
