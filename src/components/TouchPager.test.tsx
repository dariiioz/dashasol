// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PagedItems, TouchPager } from './TouchPager';
afterEach(cleanup);
it('changes screens with touch-sized buttons and removes inactive controls from keyboard navigation', () => {
  const { container } = render(<TouchPager labels={['Énergie', 'Courses']}><section>Énergie</section><section>Courses</section></TouchPager>);
  (container.querySelector('.touch-track') as HTMLElement).scrollTo = vi.fn();
  expect(container.querySelectorAll('.touch-screen')[1].hasAttribute('inert')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Écran suivant' }));
  expect(container.querySelectorAll('.touch-screen')[0].hasAttribute('inert')).toBe(true);
  expect(container.querySelectorAll('.touch-screen')[1].hasAttribute('inert')).toBe(false);
  expect((screen.getByRole('button', { name: 'Écran suivant' }) as HTMLButtonElement).disabled).toBe(true);
  vi.restoreAllMocks();
});
it('keeps every list item reachable through pagination without a scrolling list', () => {
  render(<PagedItems size={2}>{['Pain', 'Lait', 'Fruits', 'Café', 'Riz'].map(item => <span key={item}>{item}</span>)}</PagedItems>);
  expect(screen.getByText('Pain')).toBeTruthy(); expect(screen.queryByText('Riz')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Éléments suivants' }));
  expect(screen.getByText('Fruits')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Éléments suivants' }));
  expect(screen.getByText('Riz')).toBeTruthy();
});
