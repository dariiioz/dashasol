/** Calendar boundaries use local midnights, including daylight-saving changes. */
export function calendarMonth(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const count = Math.ceil((offset + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7) * 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  const days = Array.from({ length: count }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + count);
  return { start, end, days, weeks: count / 7 };
}
