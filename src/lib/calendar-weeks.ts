// ============================================================
// Calendar week utilities — all weeks are Monday to Sunday
// ============================================================

/**
 * Get the start of the current calendar week (Monday 00:00 local time).
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Get the start of a week N weeks ago (Monday 00:00).
 * 0 = current week, 1 = last week, etc.
 */
export function getWeekStartNWeeksAgo(weeksAgo: number, date: Date = new Date()): Date {
  const ws = getWeekStart(date);
  ws.setDate(ws.getDate() - weeksAgo * 7);
  return ws;
}

/**
 * Get the end of the current calendar week (Sunday 23:59:59).
 */
export function getWeekEnd(date: Date = new Date()): Date {
  const ws = getWeekStart(date);
  const we = new Date(ws);
  we.setDate(we.getDate() + 7);
  we.setMilliseconds(-1); // Sunday 23:59:59.999
  return we;
}

/**
 * Get the end of a week N weeks ago.
 */
export function getWeekEndNWeeksAgo(weeksAgo: number, date: Date = new Date()): Date {
  const ws = getWeekStartNWeeksAgo(weeksAgo, date);
  const we = new Date(ws);
  we.setDate(we.getDate() + 7);
  we.setMilliseconds(-1);
  return we;
}

/**
 * Check if a date falls within the current calendar week (Mon-Sun).
 */
export function isInCurrentWeek(date: Date): boolean {
  const ws = getWeekStart();
  const we = getWeekEnd();
  return date >= ws && date <= we;
}

/**
 * Check if a date falls within a specific week N weeks ago.
 */
export function isInWeek(date: Date, weeksAgo: number): boolean {
  const ws = getWeekStartNWeeksAgo(weeksAgo);
  const we = getWeekEndNWeeksAgo(weeksAgo);
  return date >= ws && date <= we;
}

/**
 * Get a date N weeks ago (same day of week, same time).
 * For backward compatibility with rolling-window code.
 */
export function getDateWeeksAgo(weeks: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - weeks * 7);
  return d;
}
