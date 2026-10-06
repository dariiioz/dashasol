export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'auth_error' | 'error';
export interface HassEntity<A extends Record<string, unknown> = Record<string, unknown>> { entity_id: string; state: string; attributes: A; last_changed: string; last_updated: string; context?: { id: string } }
export interface HassStateChanged { entity_id: string; new_state: HassEntity | null; old_state: HassEntity | null }
export interface HassConfig { url: string; token: string; homeName: string; internalUrl?: string; externalUrl?: string }
export type HassIncoming = { type: 'auth_required'; ha_version?: string } | { type: 'auth_ok'; ha_version: string } | { type: 'auth_invalid'; message: string } | { type: 'result'; id: number; success: boolean; result?: unknown; error?: { message: string; code?: string } } | { type: 'event'; id: number; event: { event_type: 'state_changed'; data: HassStateChanged } } | { type: 'pong'; id?: number };
export interface EntityMapping { power?: string; energyRates?: Array<number | null>; weather?: string; outdoorTemperature?: string; outdoorHumidity?: string; uv?: string; wind?: string; sun?: string; tempoToday?: string; tempoTomorrow?: string; temperatures?: string[]; climates?: string[]; covers?: string[]; mediaPlayers?: string[] }
export interface EntitySelection { entityId: string; roomName?: string; areaId?: string; icon?: string; enabled: boolean; order: number }
/** Personal display names, one per entity id, shared by every page of the interface. */
export type EntityLabels = Record<string, string>;
export interface DashboardEntityConfig { temperatureEntities: EntitySelection[]; climateEntities: EntitySelection[]; coverEntities: EntitySelection[]; mediaEntities: EntitySelection[]; updateEntities: EntitySelection[]; automationLower?: EntitySelection; automationUpper?: EntitySelection }
/** Spotify is reached straight from the browser: the Client ID is public and only a rotating refresh token is kept. */
export interface SpotifyConfig { clientId?: string; refreshToken?: string; pinned?: PinnedPlaylist[] }
/** Playlists the household pinned to the shelf, kept locally so they survive a Spotify library reshuffle. */
export interface PinnedPlaylist { uri: string; name: string; cover?: string; tracks?: number }
/** OpenRouter is called straight from the browser: one key, one model id, and nothing else to configure. */
export interface AssistantConfig { apiKey?: string; model?: string; voice?: boolean }
export interface HassRegistries { entities: Array<Record<string, unknown>>; devices: Array<Record<string, unknown>>; areas: Array<Record<string, unknown>> }
export interface RoomConfig { id: string; name: string; temperature?: string; humidity?: string; climate?: string; cover?: string; order: number; hidden?: boolean }
export interface AppPreferences { theme: 'dark' | 'light' | 'auto'; hour12: boolean; reducedMotion: boolean; autoHomeSeconds: number; confirmGlobalActions: boolean; showUnavailable: boolean; startupPage: Page }
export type Page = 'home' | 'temperatures' | 'heating' | 'covers' | 'media' | 'household' | 'settings';
