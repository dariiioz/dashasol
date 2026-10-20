import { useAppStore } from '../../stores/appStore';
import { coverCommandKeys, coverCommandLabels, resolveCoverCommand } from '../../services/home-assistant/coverCommands';
import { useEntityName } from '../../hooks/useEntityName';
export function CoverCommandSettings() {
  const dashboard = useAppStore(s => s.dashboard); const setDashboard = useAppStore(s => s.setDashboard); const entities = useAppStore(s => s.entities); const name = useEntityName();
  const demo = useAppStore(s => s.demo);
  const candidates = Object.values(entities).filter(entity => /^(automation|script|cover)\./.test(entity.entity_id));
  return <div className="automation-settings"><h3>Commandes rapides des volets</h3>{coverCommandKeys.map(key => {
    const selected = dashboard.coverCommands?.[key] ?? '';
    const resolved = resolveCoverCommand(key, dashboard, entities, demo);
    return <label key={key}>{coverCommandLabels[key]}<select value={selected} onChange={event => { const commands = { ...dashboard.coverCommands }; if (event.target.value) commands[key] = event.target.value; else delete commands[key]; setDashboard({ ...dashboard, coverCommands: commands }); }}><option value="">Automatique</option>{selected && !entities[selected] && <option value={selected}>Commande indisponible</option>}{candidates.map(entity => <option key={entity.entity_id} value={entity.entity_id}>{name(entity)}</option>)}</select><small className="muted">{!resolved.targets.length ? 'Aucune cible disponible' : resolved.targets.length > 1 ? `${resolved.targets.length} volets sélectionnés` : name(entities[resolved.targets[0]] ?? resolved.targets[0])}</small></label>;
  })}</div>;
}
