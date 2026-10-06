import { memo, useId } from 'react';
import { chartPoints, type HistoryPoint } from '../../services/home-assistant/history';
import { temperature } from '../../utils/entities';

export const TemperatureChart = memo(function TemperatureChart({ points, start, end, unit, name, loading, formatValue }: { points: HistoryPoint[]; start: number; end: number; unit: string; name: string; loading: boolean; formatValue?: (value: number) => string }) {
  const titleId = useId();
  const format = formatValue ?? ((value: number) => temperature(value, unit));
  const numeric = points.filter((point): point is HistoryPoint & { value: number } => point.value !== null);
  if (!numeric.length) return <div className="history-empty">{loading ? 'Chargement de l’historique…' : 'Aucune mesure enregistrée sur cette période.'}</div>;
  const min = numeric.reduce((value, point) => Math.min(value, point.value), Infinity);
  const max = numeric.reduce((value, point) => Math.max(value, point.value), -Infinity);
  const padding = Math.max(.3, (max - min) * .15);
  const low = min - padding; const high = max + padding;
  const x = (time: number) => 8 + Math.max(0, Math.min(1, (time - start) / Math.max(1, end - start))) * 284;
  const y = (value: number) => 8 + (high - value) / (high - low) * 72;
  let path = ''; let drawing = false;
  for (const point of chartPoints(points)) {
    if (point.value === null) { if (drawing) path += ` H ${x(point.time).toFixed(2)}`; drawing = false; continue; }
    path += drawing ? ` H ${x(point.time).toFixed(2)} V ${y(point.value).toFixed(2)}` : ` M ${x(point.time).toFixed(2)} ${y(point.value).toFixed(2)}`;
    drawing = true;
  }
  if (drawing) path += ' H 292';
  const long = end - start > 24 * 3_600_000;
  const formatTime = (time: number) => new Intl.DateTimeFormat('fr-FR', long ? { day: 'numeric', month: 'short' } : end - start >= 24 * 3_600_000 ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' }).format(time);
  return <figure className="temperature-history">
    <svg viewBox="0 0 300 88" preserveAspectRatio="none" role="img" aria-labelledby={titleId}>
      <title id={titleId}>{name} : évolution de {formatTime(start)} à {formatTime(end)}, minimum {format(min)}, maximum {format(max)}.</title>
      {[20, 44, 68].map(height => <line key={height} x1="8" y1={height} x2="292" y2={height} className="history-gridline" />)}
      <path d={path} className="history-line" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className="history-axis"><span>{formatTime(start)}</span><span>{formatTime((start + end) / 2)}</span><span>{formatTime(end)}</span></div>
    <figcaption><span>Min <b>{format(min)}</b></span><span>Max <b>{format(max)}</b></span></figcaption>
  </figure>;
});
