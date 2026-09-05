export type TrendRange = 'daily' | 'weekly' | 'monthly';

export interface TrendWindow {
  /** Inclusive lower bound of the whole window -- use as a `createdAt >= start` filter. */
  start: Date;
  /** Ordered bucket keys covering the window, oldest first, including empty periods. */
  keys: string[];
  /** Maps a row's date to the bucket key it belongs in. */
  keyFor: (date: Date) => string;
}

const DAILY_BUCKETS = 14;
const WEEKLY_BUCKETS = 8;
const MONTHLY_BUCKETS = 12;

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const dayIndex = (result.getDay() + 6) % 7; // Monday = 0
  result.setDate(result.getDate() - dayIndex);
  return result;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const isoMonth = (date: Date) => date.toISOString().slice(0, 7);

/**
 * Builds the ordered set of period buckets for a Dashboard/Reports trend chart,
 * grouping in application code (rather than `DATE_TRUNC`) so aggregation stays in
 * plain, type-safe Prisma reads -- fine at the invoice volumes an SMB POS produces.
 */
export function buildTrendWindow(
  range: TrendRange,
  now = new Date(),
): TrendWindow {
  if (range === 'daily') {
    const start = startOfDay(now);
    start.setDate(start.getDate() - (DAILY_BUCKETS - 1));
    const keys = Array.from({ length: DAILY_BUCKETS }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return isoDate(d);
    });
    return { start, keys, keyFor: (d) => isoDate(startOfDay(d)) };
  }

  if (range === 'weekly') {
    const start = startOfWeek(now);
    start.setDate(start.getDate() - 7 * (WEEKLY_BUCKETS - 1));
    const keys = Array.from({ length: WEEKLY_BUCKETS }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + 7 * i);
      return isoDate(d);
    });
    return { start, keys, keyFor: (d) => isoDate(startOfWeek(d)) };
  }

  const start = startOfMonth(now);
  start.setMonth(start.getMonth() - (MONTHLY_BUCKETS - 1));
  const keys = Array.from({ length: MONTHLY_BUCKETS }, (_, i) =>
    isoMonth(new Date(start.getFullYear(), start.getMonth() + i, 1)),
  );
  return { start, keys, keyFor: (d) => isoMonth(startOfMonth(d)) };
}
