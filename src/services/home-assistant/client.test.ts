import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeAssistantClient, toWebsocketUrl } from './client';
class MockSocket { static OPEN = 1; static instances: MockSocket[] = []; readyState = 1; sent: string[] = []; onmessage?: (event: MessageEvent) => void; onclose?: () => void; onerror?: () => void; constructor() { MockSocket.instances.push(this); } send(value: string) { this.sent.push(value); } close() { this.onclose?.(); } receive(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent); } }
vi.stubGlobal('WebSocket', MockSocket);
afterEach(() => { MockSocket.instances = []; vi.useRealTimers(); });
describe('HomeAssistantClient', () => {
  it('converts HTTPS endpoint to WSS', () => expect(toWebsocketUrl('https://ha.local:8123')).toBe('wss://ha.local:8123/api/websocket'));
  it('authenticates and routes results by request id', async () => { const client = new HomeAssistantClient({ url: 'http://ha.local:8123', token: 'secret', homeName: 'Home' }); client.connect(); const socket = MockSocket.instances.at(-1)!; socket.receive({ type: 'auth_required' }); expect(JSON.parse(socket.sent[0]!).access_token).toBe('secret'); socket.receive({ type: 'auth_ok', ha_version: '2026.1' }); const states = client.getStates(); expect(JSON.parse(socket.sent[1]!).id).toBe(1); socket.receive({ type: 'result', id: 1, success: true, result: [{ entity_id: 'sensor.x' }] }); await expect(states).resolves.toEqual([{ entity_id: 'sensor.x' }]); });
  it('sends a typed service call', async () => { const client = new HomeAssistantClient({ url: 'http://ha', token: 'x', homeName: 'Home' }); client.connect(); const socket = MockSocket.instances.at(-1)!; const request = client.callService('cover', 'set_cover_position', { position: 50 }, { entity_id: 'cover.salon' }); const message = JSON.parse(socket.sent[0]!); expect(message).toMatchObject({ type: 'call_service', domain: 'cover', service: 'set_cover_position', target: { entity_id: 'cover.salon' } }); socket.receive({ type: 'result', id: message.id, success: true, result: [] }); await expect(request).resolves.toEqual([]); });
  it('dispatches state_changed events', () => { const client = new HomeAssistantClient({ url: 'http://ha', token: 'x', homeName: 'Home' }); const listener = vi.fn(); client.onState(listener); client.connect(); const socket = MockSocket.instances.at(-1)!; socket.receive({ type: 'event', id: 4, event: { event_type: 'state_changed', data: { entity_id: 'sensor.a', old_state: null, new_state: null } } }); expect(listener).toHaveBeenCalledWith(expect.objectContaining({ entity_id: 'sensor.a' })); });
  it('keeps a silent connection alive with a ping and its pong', async () => { vi.useFakeTimers(); const client = new HomeAssistantClient({ url: 'http://ha', token: 'x', homeName: 'Home' }); client.connect(); const socket = MockSocket.instances.at(-1)!; socket.receive({ type: 'auth_required' }); socket.receive({ type: 'auth_ok', ha_version: '2026.1' }); await vi.advanceTimersByTimeAsync(HomeAssistantClient.pingInterval); const ping = JSON.parse(socket.sent.at(-1)!); expect(ping.type).toBe('ping'); socket.receive({ type: 'pong', id: ping.id }); await vi.advanceTimersByTimeAsync(HomeAssistantClient.pongTimeout + 1000); expect(MockSocket.instances).toHaveLength(1); client.disconnect(); });
  it('closes a half-open socket when no pong answers', async () => { vi.useFakeTimers(); const client = new HomeAssistantClient({ url: 'http://ha', token: 'x', homeName: 'Home' }); const statuses: string[] = []; client.onStatus(status => statuses.push(status)); client.connect(); const socket = MockSocket.instances.at(-1)!; socket.receive({ type: 'auth_required' }); socket.receive({ type: 'auth_ok', ha_version: '2026.1' }); await vi.advanceTimersByTimeAsync(HomeAssistantClient.pingInterval); await vi.advanceTimersByTimeAsync(HomeAssistantClient.pongTimeout); expect(statuses).toContain('offline'); await vi.advanceTimersByTimeAsync(2000); expect(MockSocket.instances).toHaveLength(2); client.disconnect(); });
  it('reconnects after an interrupted socket', () => { vi.useFakeTimers(); const client = new HomeAssistantClient({ url: 'http://ha', token: 'x', homeName: 'Home' }); client.connect(); MockSocket.instances[0]!.close(); vi.advanceTimersByTime(1400); expect(MockSocket.instances).toHaveLength(2); client.disconnect(); });
});

it('rejects an unanswered command without waiting forever', async () => {
  vi.useFakeTimers();
  const client = new HomeAssistantClient({ url: 'http://ha', token: 'x', homeName: 'Home' });
  client.connect();
  const request = client.callService('cover', 'close_cover', {}, { entity_id: 'cover.salon' });
  const rejected = expect(request).rejects.toThrow('pas confirmé');
  await vi.advanceTimersByTimeAsync(HomeAssistantClient.requestTimeout);
  await rejected;
  client.disconnect();
});

it('requests history over WebSocket for the selected sensors and period', async () => {
  const client = new HomeAssistantClient({ url: 'http://ha', token: 'x', homeName: 'Home' });
  client.connect();
  const socket = MockSocket.instances.at(-1)!;
  const start = new Date('2026-10-05T12:00:00Z'); const end = new Date('2026-10-06T12:00:00Z');
  const request = client.getHistory(['sensor.salon'], start, end);
  const message = JSON.parse(socket.sent.at(-1)!);
  expect(message).toMatchObject({ type: 'history/history_during_period', entity_ids: ['sensor.salon'], start_time: start.toISOString(), end_time: end.toISOString(), no_attributes: true, minimal_response: true, include_start_time_state: true });
  socket.receive({ type: 'result', id: message.id, success: true, result: { 'sensor.salon': [{ s: '20', lu: start.getTime() / 1000 }] } });
  await expect(request).resolves.toHaveProperty('sensor.salon');
  client.disconnect();
});
