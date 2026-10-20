import { expect, it } from 'vitest';
import { calendarMonth } from './calendar';
it.each([[2021, 1, 4], [2026, 9, 5], [2026, 7, 6]])('fits %i/%i in the necessary %i full weeks', (year, month, weeks) => {
  const range = calendarMonth(new Date(year, month, 1));
  expect(range.weeks).toBe(weeks);
  expect(range.days).toHaveLength(weeks * 7);
  expect(range.start.getDay()).toBe(1);
  expect(range.days.at(-1)?.getDay()).toBe(0);
  expect(new Set(range.days.map(date => date.toDateString())).size).toBe(weeks * 7);
  const after = new Date(range.days.at(-1)!); after.setDate(after.getDate() + 1);
  expect(range.end.getTime()).toBe(after.getTime());
});
