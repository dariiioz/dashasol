// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ScreensaverHost } from './Screensaver';
import { useScreensaverStore } from '../stores/screensaverStore';
import { useAppStore } from '../stores/appStore';
vi.mock('../hooks/useWeather', () => ({ useWeather: () => ({ forecast: { current: { temperature: 12, code: 3, day: true } } }) }));
vi.mock('../hooks/useClock', () => ({ useClock: () => new Date('2026-10-20T14:00:00') }));
beforeEach(() => {
  vi.useFakeTimers();
  useScreensaverStore.setState({ active: false });
  useAppStore.setState({ configured: true, demo: false });
  useAppStore.getState().setPreferences({ wall: { keepAwake: false, nightMode: false, nightStart: '22:00', nightEnd: '07:00', screensaverSeconds: 120 } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('activates after inactivity, resets on interaction and dismisses explicitly', () => {
  render(<ScreensaverHost />);
  act(() => vi.advanceTimersByTime(119000));
  fireEvent.pointerDown(window);
  act(() => vi.advanceTimersByTime(119000));
  expect(screen.queryByRole('dialog')).toBeNull();
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('dialog', { name: 'Écran de veille' })).toBeTruthy();
  expect(screen.getByText('12°')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Déverrouiller l’écran' }));
  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('makes the application inert and restores it, while manual-only mode stays idle', () => {
  useAppStore.getState().setPreferences({ wall: { keepAwake: false, nightMode: false, nightStart: '22:00', nightEnd: '07:00', screensaverSeconds: 0 } });
  const view = render(<><p>Agenda personnel</p><ScreensaverHost /></>);
  act(() => vi.advanceTimersByTime(600000));
  expect(screen.queryByRole('dialog')).toBeNull();
  act(() => useScreensaverStore.getState().activate());
  expect(view.container.inert).toBe(true);
  act(() => useScreensaverStore.getState().dismiss());
  expect(Boolean(view.container.inert)).toBe(false);
});
