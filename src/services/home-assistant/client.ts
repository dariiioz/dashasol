import type { HassConfig, HassEntity, HassIncoming, HassRegistries, HassStateChanged } from '../../types/homeAssistant';

type StateListener = (change: HassStateChanged) => void;
type StatusListener = (status: 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'auth_error' | 'error', detail?: string) => void;
const toWebsocketUrl = (url: string) => {
  const parsed = new URL(url.trim());
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}/api/websocket`.replace(/\/api\/websocket\/api\/websocket$/, '/api/websocket');
  return parsed.toString();
};

/** Browser-only Home Assistant websocket protocol client. Never logs credentials. */
export class HomeAssistantClient {
  static pingInterval = 30_000; static pongTimeout = 10_000; static requestTimeout = 15_000;
  private socket?: WebSocket; private nextId = 1; private pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void; timeout: number }>();
  private reconnectTimer?: number; private heartbeatTimer?: number; private retries = 0; private deliberate = false; private subscribed = false;
  private stateListeners = new Set<StateListener>(); private statusListeners = new Set<StatusListener>();
  constructor(private config: HassConfig) {}
  onState(listener: StateListener) { this.stateListeners.add(listener); return () => this.stateListeners.delete(listener); }
  onStatus(listener: StatusListener) { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  private status(status: Parameters<StatusListener>[0], detail?: string) { this.statusListeners.forEach(listener => listener(status, detail)); }
  connect() { this.deliberate = false; this.open(false); }
  disconnect() { this.deliberate = true; globalThis.clearTimeout(this.reconnectTimer); this.stopHeartbeat(); this.socket?.close(); this.socket = undefined; this.subscribed = false; this.rejectPending('Connexion fermée'); }
  private open(isReconnect: boolean) {
    try { this.status(isReconnect ? 'reconnecting' : 'connecting'); this.socket = new WebSocket(toWebsocketUrl(this.config.url)); }
    catch { this.status('error', 'L’adresse Home Assistant semble incorrecte.'); return; }
    this.socket.onmessage = event => this.receive(JSON.parse(String(event.data)) as HassIncoming);
    this.socket.onerror = () => this.status('offline', 'Home Assistant est inaccessible.');
    this.socket.onclose = () => { this.subscribed = false; this.stopHeartbeat(); this.rejectPending('Connexion interrompue'); if (!this.deliberate) this.scheduleReconnect(); };
  }
  private receive(message: HassIncoming) {
    if (message.type === 'auth_required') { this.send({ type: 'auth', access_token: this.config.token }); return; }
    if (message.type === 'auth_ok') { this.retries = 0; this.status('connected'); this.startHeartbeat(); return; }
    if (message.type === 'pong') { const request = message.id === undefined ? undefined : this.pending.get(message.id); if (request) { this.pending.delete(message.id!); request.resolve(undefined); } return; }
    if (message.type === 'auth_invalid') { this.deliberate = true; this.status('auth_error', 'Le jeton Home Assistant a été refusé.'); this.socket?.close(); return; }
    if (message.type === 'event' && message.event.event_type === 'state_changed') { this.stateListeners.forEach(listener => listener(message.event.data)); return; }
    if (message.type === 'result') { const request = this.pending.get(message.id); if (!request) return; this.pending.delete(message.id); message.success ? request.resolve(message.result) : request.reject(new Error(message.error?.message ?? 'Home Assistant a refusé la commande.')); }
  }
  private send(payload: Record<string, unknown>) { if (this.socket?.readyState !== WebSocket.OPEN) throw new Error('Connexion indisponible'); this.socket.send(JSON.stringify(payload)); }
  request<T>(payload: Record<string, unknown>): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => { this.pending.delete(id); reject(new Error('Home Assistant n’a pas confirmé la commande. Vérifiez son état avant de réessayer.')); }, HomeAssistantClient.requestTimeout);
      this.pending.set(id, {
        timeout,
        resolve: value => { globalThis.clearTimeout(timeout); resolve(value as T); },
        reject: reason => { globalThis.clearTimeout(timeout); reject(reason); }
      });
      try { this.send({ id, ...payload }); } catch (error) { globalThis.clearTimeout(timeout); this.pending.delete(id); reject(error); }
    });
  }
  async getStates() { return this.request<HassEntity[]>({ type: 'get_states' }); }
  async getHistory(entityIds: string[], start: Date, end: Date) {
    return this.request<unknown>({ type: 'history/history_during_period', entity_ids: entityIds, start_time: start.toISOString(), end_time: end.toISOString(), include_start_time_state: true, significant_changes_only: false, minimal_response: true, no_attributes: true });
  }
  async getRegistries(): Promise<HassRegistries> { const [entities, devices, areas] = await Promise.all([this.request<Array<Record<string, unknown>>>({ type: 'config/entity_registry/list' }), this.request<Array<Record<string, unknown>>>({ type: 'config/device_registry/list' }), this.request<Array<Record<string, unknown>>>({ type: 'config/area_registry/list' })]); return { entities, devices, areas }; }
  async subscribeStates() { if (this.subscribed) return; await this.request({ type: 'subscribe_events', event_type: 'state_changed' }); this.subscribed = true; }
  callService(domain: string, service: string, serviceData: Record<string, unknown>, target?: { entity_id: string | string[] }) { return this.request<HassEntity[]>({ type: 'call_service', domain, service, service_data: serviceData, target }); }
  /** A wall tablet can keep a half-open socket for hours behind a proxy: an unanswered ping is the only reliable signal. */
  private startHeartbeat() { this.stopHeartbeat(); this.heartbeatTimer = globalThis.setInterval(() => { let expired: number | undefined; const pong = this.request({ type: 'ping' }); const deadline = new Promise((_, reject) => { expired = globalThis.setTimeout(() => reject(new Error('Aucune réponse de Home Assistant')), HomeAssistantClient.pongTimeout); }); void Promise.race([pong, deadline]).then(() => globalThis.clearTimeout(expired), () => { globalThis.clearTimeout(expired); this.status('offline', 'Home Assistant ne répond plus.'); this.socket?.close(); }); }, HomeAssistantClient.pingInterval); }
  private stopHeartbeat() { globalThis.clearInterval(this.heartbeatTimer); this.heartbeatTimer = undefined; }
  private scheduleReconnect() { const delay = Math.min(30_000, 1000 * 2 ** this.retries++) + Math.round(Math.random() * 300); this.status('reconnecting'); this.reconnectTimer = globalThis.setTimeout(() => this.open(true), delay); }
  private rejectPending(message: string) { this.pending.forEach(({ reject }) => reject(new Error(message))); this.pending.clear(); }
}
export { toWebsocketUrl };
