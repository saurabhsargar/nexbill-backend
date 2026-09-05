/** Builds a Prisma `DateTimeFilter` from optional ISO from/to query params. */
export function buildDateRangeFilter(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };
}
