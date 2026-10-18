// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EufyLiveVideo } from './EufyLiveVideo';
let incoming: ReadableStreamDefaultController<Uint8Array>; let end = 0; let paused = true;
class SourceBufferFake extends EventTarget {
  buffered = { length: 0, start: () => 0 };
  appendBuffer(value: ArrayBuffer) { end = new Uint8Array(value)[0]; queueMicrotask(() => this.dispatchEvent(new Event('updateend'))); }
  remove() { queueMicrotask(() => this.dispatchEvent(new Event('updateend'))); }
}
class MediaSourceFake extends EventTarget {
  readyState = 'open'; static isTypeSupported() { return true; }
  constructor() { super(); queueMicrotask(() => this.dispatchEvent(new Event('sourceopen'))); }
  addSourceBuffer() { return new SourceBufferFake(); }
  endOfStream() { this.readyState = 'ended'; }
}
beforeEach(() => {
  end = 0; paused = true;
  vi.stubGlobal('MediaSource', MediaSourceFake);
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:test') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
  vi.spyOn(HTMLMediaElement.prototype, 'buffered', 'get').mockImplementation(() => ({ length: end ? 1 : 0, start: () => 0, end: () => end }));
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => paused);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLVideoElement) { paused = true; this.dispatchEvent(new Event('pause')); });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async function (this: HTMLVideoElement) {
    paused = false;
    // Browsers may report waiting while play() is still starting the decoder.
    this.dispatchEvent(new Event('waiting'));
    await Promise.resolve();
    if (paused) throw new DOMException('Interrupted by pause', 'AbortError');
    this.dispatchEvent(new Event('playing'));
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start(controller) { incoming = controller; } }), { headers: { 'Content-Type': 'video/mp4; codecs="avc1.64001f"' } })));
});
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const chunk = async (value: number) => { await act(async () => { incoming.enqueue(new Uint8Array([value])); await settle(); }); };
afterEach(async () => { cleanup(); incoming?.close(); await settle(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('buffers before starting and does not pause its own pending play request', async () => {
  await act(async () => { render(<EufyLiveVideo close={vi.fn()} />); await settle(); });
  await chunk(1); expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  await chunk(4); expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  expect(paused).toBe(false); expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
  expect(screen.queryByText('Appuie sur lecture pour afficher la vidéo.')).toBeNull();
});
it('resumes after a real underrun and respects a deliberate pause', async () => {
  await act(async () => { render(<EufyLiveVideo close={vi.fn()} />); await settle(); });
  await chunk(4);
  const video = screen.getByLabelText('Vidéo en direct de la sonnette Eufy') as HTMLVideoElement;
  video.currentTime = 3.95; fireEvent.waiting(video);
  expect(paused).toBe(true); expect(screen.getByText('Stabilisation de la vidéo…')).toBeTruthy();
  await chunk(8); expect(paused).toBe(false); expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  act(() => { video.pause(); });
  await chunk(12); expect(paused).toBe(true); expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
});
