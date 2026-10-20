import { useState } from 'react';
const views = [{ key: 'front_right', label: 'Avant' }, { key: 'side_right', label: 'Profil' }, { key: 'back_right', label: 'Arrière' }, { key: 'front_left', label: 'Autre côté' }];
export function VehicleScene({ charging, reducedMotion }: { charging: boolean; reducedMotion: boolean }) {
  const [view, setView] = useState(0);
  return <div className="vehicle-photo-scene" data-motion={reducedMotion ? 'reduced' : 'full'} data-charging={charging}>
    <div className="vehicle-orbit vehicle-orbit-one" /><div className="vehicle-orbit vehicle-orbit-two" />
    <div className="vehicle-photo-stage">{views.map((angle, index) => <img key={angle.key} className={view === index ? 'active' : ''} src={`/vehicles/id4-${angle.key}.webp`} alt={view === index ? `Volkswagen ID.4 grise · ${angle.label}` : ''} aria-hidden={view !== index} draggable={false} />)}</div>
    {charging && <div className="vehicle-charge-particles" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--particle': i } as React.CSSProperties} />)}</div>}
    <div className="vehicle-view-buttons" aria-label="Angle du véhicule">{views.map((angle, index) => <button key={angle.key} aria-pressed={view === index} onClick={() => setView(index)}>{angle.label}</button>)}</div>
  </div>;
}
