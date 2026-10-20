import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCoverCommands } from '../../hooks/useCoverCommands';
export function CoverQuickCommands() {
  const { commands, run, sending, connected } = useCoverCommands();
  return <div className="cover-quick-commands" aria-busy={sending}><div className="cover-quick-grid">{commands.map(command => <button key={command.key} disabled={sending || !connected || !command.targets.length} onClick={() => void run(command.key)}>{command.opening ? <ChevronUp size={20} /> : <ChevronDown size={20} />}<span>{command.label}</span></button>)}</div></div>;
}
