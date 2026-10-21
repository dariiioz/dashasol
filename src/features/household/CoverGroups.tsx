import { useCoverCommands } from '../../hooks/useCoverCommands';
import type { CoverCommandKey } from '../../types/homeAssistant';

export function CoverGroups({ disabled = false }: { disabled?: boolean }) {
  const grouped = useCoverCommands();
  return <div className="cover-groups">{(['Bas', 'Haut'] as const).map(label => <div key={label}><b>{label}</b>{(['Open', 'Close'] as const).map(action => {
    const key = `${label === 'Bas' ? 'lower' : 'upper'}${action}` as CoverCommandKey;
    const command = grouped.commands.find(item => item.key === key);
    return <button key={action} disabled={disabled || !grouped.connected || grouped.sending || !command?.targets.length} onClick={() => void grouped.run(key)}>{action === 'Open' ? 'Ouvrir' : 'Fermer'} le {label.toLowerCase()}</button>;
  })}</div>)}</div>;
}
