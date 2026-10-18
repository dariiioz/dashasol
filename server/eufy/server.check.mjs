import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from './server.mjs';
import { smoothVideoFragment } from './smooth-fragments.mjs';
const server = createServer(); let base;
before(async () => { await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); });
test('status needs custom header and returns no account data when disconnected', async () => {
  let response = await fetch(base + '/api/eufy/status'); assert.equal(response.status, 403);
  response = await fetch(base + '/api/eufy/status', { headers: { 'X-Domoryx-Eufy': '1' } });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { phase: 'disconnected', devices: [], selected: null, events: [], readAt: null });
});
test('cross-origin writes and requests without a session are refused', async () => {
  const headers = { 'X-Domoryx-Eufy': '1', 'Content-Type': 'application/json', Origin: 'https://other.example' };
  let response = await fetch(base + '/api/eufy/login', { method: 'POST', headers, body: '{}' }); assert.equal(response.status, 403);
  response = await fetch(base + '/api/eufy/image', { headers }); assert.equal(response.status, 401);
});
test('invalid login is rejected without contacting Eufy', async () => {
  const response = await fetch(base + '/api/eufy/login', { method: 'POST', headers: { 'X-Domoryx-Eufy': '1', 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: 'invalid', password: '' }) });
  assert.equal(response.status, 400); assert.equal(response.headers.get('set-cookie'), null);
});

function mp4box(type, ...buffers) {
  const payload = Buffer.concat(buffers); const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8); header.write(type, 4); return Buffer.concat([header, payload]);
}
function track(id, durations) {
  const tfhd = Buffer.alloc(8); tfhd.writeUInt32BE(id, 4);
  const trun = Buffer.alloc(8 + durations.length * 8); trun.writeUIntBE(0x300, 1, 3); trun.writeUInt32BE(durations.length, 4);
  durations.forEach((duration, index) => { trun.writeUInt32BE(duration, 8 + index * 8); trun.writeUInt32BE(100 + index, 12 + index * 8); });
  return mp4box('traf', mp4box('tfhd', tfhd), mp4box('tfdt', Buffer.alloc(12)), mp4box('trun', trun));
}
test('network arrival jitter is paced evenly without changing GOP length, audio or compressed data', () => {
  const samples = [500, 700, 18000, 4800];
  const video = track(1, samples); const audio = track(2, [1024, 1024]);
  const mdat = mp4box('mdat', Buffer.from('untouched compressed picture/audio bytes'));
  const original = Buffer.concat([mp4box('moof', video, audio), mdat]);
  const result = smoothVideoFragment(original);
  const trun = result.indexOf('trun') + 12;
  const paced = samples.map((_, i) => result.readUInt32BE(trun + i * 8));
  assert.deepEqual(paced, [6000, 6000, 6000, 6000]);
  assert.equal(paced.reduce((a, b) => a + b), samples.reduce((a, b) => a + b));
  assert.deepEqual(original.subarray(8 + video.length, 8 + video.length + audio.length), result.subarray(8 + video.length, 8 + video.length + audio.length));
  assert.deepEqual(result.subarray(-mdat.length), mdat);
  assert.equal(original.readUInt32BE(trun), 500);
  assert.equal(result.readUInt32BE(trun + 4), original.readUInt32BE(trun + 4));
});
test('rounding preserves the exact duration and real long outages are not smoothed', () => {
  const original = mp4box('moof', track(1, [5000, 5000, 10001]));
  const result = smoothVideoFragment(original); const offset = result.indexOf('trun') + 12;
  assert.equal([0, 1, 2].reduce((sum, i) => sum + result.readUInt32BE(offset + i * 8), 0), 20001);
  const gap = mp4box('moof', track(1, [6000, 270000, 6000]));
  assert.equal(smoothVideoFragment(gap), gap);
  assert.deepEqual(smoothVideoFragment(Buffer.from('invalid')), Buffer.from('invalid'));
});
