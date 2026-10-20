import type { CoverCommandKey, DashboardEntityConfig, HassEntity } from '../../types/homeAssistant';
import { selectedIds } from '../../utils/dashboard';
import { unavailable } from '../../utils/entities';
import { demoAutomationTargets } from './demo';
export const coverCommandLabels: Record<CoverCommandKey, string> = { allClose: 'Tout fermer', allOpen: 'Tout ouvrir', upperOpen: 'Ouvrir volets haut', upperClose: 'Fermer volets haut', lowerOpen: 'Ouvrir volets bas', lowerClose: 'Fermer volets bas' };
export const coverCommandKeys = Object.keys(coverCommandLabels) as CoverCommandKey[];
const defaults: Partial<Record<CoverCommandKey, string>> = { upperOpen: 'script.ouvrir_volets_haut', upperClose: 'script.fermer_volets_haut', lowerOpen: 'script.ouvrir_volets_bas', lowerClose: 'script.fermeture_de_tout_les_volets_du_bas' };
export function resolveCoverCommand(key: CoverCommandKey, dashboard: DashboardEntityConfig, entities: Record<string, HassEntity>, demo = false) {
  const opening = key.endsWith('Open'); const configured = dashboard.coverCommands?.[key];
  const legacy = key === 'upperOpen' ? dashboard.automationUpper : key === 'lowerOpen' ? dashboard.automationLower : undefined;
  const available = (id?: string) => id && /^(script|automation|cover)\./.test(id) && !unavailable(entities[id]) ? id : undefined;
  // Explicit selections remain authoritative even when their target becomes unavailable.
  const explicit = configured || (legacy?.enabled !== false ? legacy?.entityId : undefined);
  const target = available(explicit ?? defaults[key]);
  const covers = selectedIds(dashboard.coverEntities).filter(id => !unavailable(entities[id]));
  const targets = target ? [target] : explicit ? [] : key.startsWith('all') ? covers : demo ? (demoAutomationTargets[`automation.ouvrir_les_volets_du_${key.startsWith('upper') ? 'haut' : 'bas'}`] ?? []).filter(id => covers.includes(id)) : [];
  const domain = target?.split('.')[0] ?? 'cover';
  return { key, label: coverCommandLabels[key], opening, targets, domain, service: domain === 'script' ? 'turn_on' : domain === 'automation' ? 'trigger' : opening ? 'open_cover' : 'close_cover' };
}
