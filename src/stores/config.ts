import type { AppPreferences, DashboardEntityConfig, EntityLabels, EntityMapping, EntitySelection, HassConfig, Page, RoomConfig, SpotifyConfig } from '../types/homeAssistant';
import { dashboardFromMapping, normalizeEntityIds } from '../utils/dashboard';
export interface PersistedSillageConfig { configured: boolean; demo: boolean; config?: HassConfig; mapping: EntityMapping; dashboard: DashboardEntityConfig; labels: EntityLabels; rooms: RoomConfig[]; preferences: AppPreferences; spotify: SpotifyConfig; activePage: Page }
export const defaultPreferences: AppPreferences = { theme: 'dark', hour12: false, reducedMotion: false, autoHomeSeconds: 180, confirmGlobalActions: true, showUnavailable: true, startupPage: 'home' };
/** Central migration point for persisted local settings. Credentials are deliberately never transformed or logged. */
export function migrateConfig(value: unknown): PersistedSillageConfig {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<PersistedSillageConfig>;
  const rawMapping = (source.mapping && typeof source.mapping === 'object' ? source.mapping : {}) as EntityMapping;
  const mapping: EntityMapping = { ...rawMapping, temperatures: normalizeEntityIds(rawMapping.temperatures), climates: normalizeEntityIds(rawMapping.climates), covers: normalizeEntityIds(rawMapping.covers) };
  const legacyDashboard = source.dashboard && typeof source.dashboard === 'object' ? source.dashboard as Partial<DashboardEntityConfig> : undefined;
  const base = dashboardFromMapping(mapping);
  const selected = (value: unknown) => normalizeEntityIds(Array.isArray(value) ? value.map(item => typeof item === 'object' && item ? (item as EntitySelection).entityId : item) : value).map((entityId, order) => ({ entityId, enabled: true, order }));
  const dashboard: DashboardEntityConfig = { ...base, temperatureEntities: selected(legacyDashboard?.temperatureEntities ?? mapping.temperatures), climateEntities: selected(legacyDashboard?.climateEntities ?? mapping.climates), coverEntities: selected(legacyDashboard?.coverEntities ?? mapping.covers), mediaEntities: selected(legacyDashboard?.mediaEntities ?? mapping.mediaPlayers), updateEntities: selected(legacyDashboard?.updateEntities) };
  const spotify = (source.spotify && typeof source.spotify === 'object' ? source.spotify : {}) as SpotifyConfig;
  return { configured: Boolean(source.configured), demo: Boolean(source.demo), config: source.config, mapping, dashboard, labels: collectLabels(source.labels, legacyDashboard), rooms: Array.isArray(source.rooms) ? source.rooms : [], preferences: { ...defaultPreferences, ...(source.preferences && typeof source.preferences === 'object' ? source.preferences : {}) }, spotify: { clientId: typeof spotify.clientId === 'string' && spotify.clientId ? spotify.clientId : import.meta.env.VITE_SPOTIFY_CLIENT_ID, refreshToken: typeof spotify.refreshToken === 'string' ? spotify.refreshToken : undefined, pinned: Array.isArray(spotify.pinned) ? spotify.pinned.filter(item => item && typeof item.uri === 'string' && typeof item.name === 'string') : [] }, activePage: source.activePage ?? 'home' };
}
/** Display names used to live per category as `customName`; they are now a single map shared by every page. */
function collectLabels(stored: unknown, legacyDashboard?: Partial<DashboardEntityConfig>): EntityLabels {
  const labels: EntityLabels = {};
  Object.values(legacyDashboard ?? {}).flatMap(value => Array.isArray(value) ? value : [value]).forEach(item => { const legacy = item as (EntitySelection & { customName?: string }) | undefined; if (legacy?.entityId && typeof legacy.customName === 'string' && legacy.customName.trim()) labels[legacy.entityId] = legacy.customName.trim(); });
  if (stored && typeof stored === 'object') Object.entries(stored as Record<string, unknown>).forEach(([entityId, label]) => { if (typeof label === 'string' && label.trim()) labels[entityId] = label.trim(); });
  return labels;
}
