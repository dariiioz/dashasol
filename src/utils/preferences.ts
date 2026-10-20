import type { HomeLayout, HomeModule, Page, WallSettings } from '../types/homeAssistant';
export const homeModules: HomeModule[] = ['tempo', 'spotify', 'vehicle', 'people', 'shopping', 'calendar'];
export const moduleNames: Record<HomeModule, string> = { tempo: 'Tempo', spotify: 'Spotify', vehicle: 'ID.4', people: 'Personnes', shopping: 'Courses', calendar: 'Calendrier' };
export const defaultWall: WallSettings = { keepAwake: false, nightMode: false, nightStart: '22:00', nightEnd: '07:00' };
export function homeLayout(value?: Partial<HomeLayout>): HomeLayout {
  return { order: [...[...new Set([...(Array.isArray(value?.order) ? value.order.filter(key => homeModules.includes(key)) : []), ...homeModules])].filter(key => key !== 'calendar'), 'calendar'], visibility: Object.fromEntries(Object.entries(value?.visibility ?? {}).filter(([key, mode]) => homeModules.includes(key as HomeModule) && ['auto', 'show', 'hide'].includes(mode))), density: value?.density === 'compact' ? 'compact' : 'comfortable' };
}
export function navigationFavorites(value?: Page[]): Page[] {
  const allowed = ['energy', 'weather', 'temperatures', 'heating', 'covers', 'media', 'vehicle', 'entry', 'planner', 'settings'];
  return [...new Set((Array.isArray(value) ? value : ['planner', 'media']).filter(page => allowed.includes(page)))].slice(0, 2) as Page[];
}
export function dashboardIds(dashboard: import('../types/homeAssistant').DashboardEntityConfig): string[] {
  const selections = [dashboard.temperatureEntities, dashboard.climateEntities, dashboard.coverEntities, dashboard.mediaEntities, dashboard.updateEntities].flat().filter(value => value?.enabled !== false).map(value => value.entityId);
  return [...new Set([...selections, dashboard.automationLower?.entityId, dashboard.automationUpper?.entityId, ...Object.values(dashboard.people ?? {}), ...Object.values(dashboard.coverCommands ?? {})].filter((id): id is string => typeof id === 'string' && id.includes('.')))];
}
