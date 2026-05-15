/**
 * Get today's date in YYYY-MM-DD format using LOCAL timezone (not UTC).
 * Avoids the off-by-one bug where toISOString() returns the next day in UTC-3
 * timezones during evening hours.
 */
export function getTodayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format a Date object to YYYY-MM-DD using local timezone.
 */
export function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a date string in YYYY-MM-DD format safely, avoiding timezone issues
 * This ensures the date is interpreted as local time, not UTC
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a date to pt-BR locale
 */
export function formatDateBR(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('pt-BR');
}

/**
 * Get month and year from a date string
 */
export function getMonthYear(dateStr: string): { month: number; year: number } {
  const date = parseLocalDate(dateStr);
  return {
    month: date.getMonth(),
    year: date.getFullYear(),
  };
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(dateStr: string, compareDate: Date): boolean {
  const date = parseLocalDate(dateStr);
  return (
    date.getDate() === compareDate.getDate() &&
    date.getMonth() === compareDate.getMonth() &&
    date.getFullYear() === compareDate.getFullYear()
  );
}
