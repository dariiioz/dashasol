import type { HassEntity } from '../types/homeAssistant';
import { unavailable } from '../utils/entities';
export function EntityState({ entity, children }: { entity?: HassEntity; children: React.ReactNode }) { return unavailable(entity) ? <span className="muted">Indisponible</span> : <>{children}</>; }
