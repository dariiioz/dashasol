// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { normalizeForecast } from '../../services/weather/client';
import { useAppStore } from '../../stores/appStore';
import { WeatherPage } from './WeatherPage';
const state = vi.hoisted(() => ({ forecast: undefined as unknown }));
vi.mock('../../hooks/useWeather', () => ({ useWeather: () => ({ forecast: state.forecast, loading: false, refresh: vi.fn() }) }));
vi.mock('./WeatherScene', () => ({ WeatherScene: () => null }));
let compact = false; let change: () => void;
const scrollTo = vi.fn(); let resized: () => void;
beforeEach(() => {
 compact = false;
 vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resized = callback; } observe() {} disconnect() {} });
 vi.stubGlobal('matchMedia', () => ({ get matches() { return compact; }, addEventListener: (_: string, callback: () => void) => { change = callback; }, removeEventListener() {} }));
 Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo }); scrollTo.mockClear();
 useAppStore.setState({ demo: false });
 const time = Math.floor(Date.now() / 1000);
 state.forecast = normalizeForecast({ current: { time, temperature_2m: 10 }, hourly: { time: [time], temperature_2m: [10] }, daily: { time: [time - 43200], temperature_2m_min: [5], temperature_2m_max: [12], weather_code: [0] } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('keeps the selected screen aligned after viewport resizing and tracks a swipe', () => {
 const { container } = render(<WeatherPage />);
 const pager = within(screen.getByRole('navigation', { name: 'Pages météo' }));
 const screens = container.querySelector('.weather-screens')!;
 Object.defineProperty(screens, 'clientWidth', { configurable: true, value: 800 });
 fireEvent.click(pager.getByRole('button', { name: 'Prévisions' }));
 expect(scrollTo).toHaveBeenLastCalledWith({ left: 800, behavior: 'smooth' });
 Object.defineProperty(screens, 'clientWidth', { configurable: true, value: 1024 });
 act(() => resized()); expect(scrollTo).toHaveBeenLastCalledWith({ left: 1024 });
 Object.defineProperty(screens, 'scrollLeft', { configurable: true, value: 2048 });
 fireEvent.scroll(screens);
 expect(pager.getByRole('button', { name: 'Air' }).getAttribute('aria-current')).toBe('page');
 expect((pager.getByRole('button', { name: 'Page météo suivante' }) as HTMLButtonElement).disabled).toBe(true);
});
it('splits details and hourly forecasts on compact screens and resets pagination on orientation change', () => {
 const { container } = render(<WeatherPage />);
 act(() => { compact = true; change(); });
 expect(container.querySelectorAll('.weather-screen').length).toBe(5);
 const pager = within(screen.getByRole('navigation', { name: 'Pages météo' }));
 expect(pager.getByRole('button', { name: 'Détails' })).toBeTruthy();
 const days = within(screen.getByRole('group', { name: 'Prévisions sur dix jours' }));
 fireEvent.click(days.getAllByRole('button')[0]);
 expect(pager.getByRole('button', { name: 'Heures' }).getAttribute('aria-current')).toBe('page');
 act(() => { compact = false; change(); });
 expect(container.querySelectorAll('.weather-screen').length).toBe(3);
 expect(pager.getByRole('button', { name: 'Maintenant' }).getAttribute('aria-current')).toBe('page');
});
