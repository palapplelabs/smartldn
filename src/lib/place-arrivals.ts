export const ETA_FRESH_MS = 60_000
export const ETA_KEEP_MS = 3 * 60_000

export type HeldRows<T> = { at: number; rows: T[] }

export function etaDue(held: { at: number } | undefined, now: number, freshMs = ETA_FRESH_MS): boolean {
  return held == null || now - held.at >= freshMs
}

export function heldRows<T>(held: HeldRows<T> | undefined, now: number, keepMs = ETA_KEEP_MS): T[] | null {
  if (!held || now - held.at > keepMs) return null
  return held.rows
}

export function forgetStale<T>(held: Map<string, HeldRows<T>>, now: number, keepMs = ETA_KEEP_MS): void {
  for (const [key, item] of held) {
    if (now - item.at > keepMs) held.delete(key)
  }
}

export function catalogueBoards<S extends { id: string }>(
  places: { ok: boolean; stops: S[] } | null,
): { ok: true; observedAt: null; stops: (S & { calls: []; clock: "waiting" })[] } | null {
  if (!places?.ok) return null
  return {
    ok: true,
    observedAt: null,
    stops: places.stops.map((stop) => ({ ...stop, calls: [] as [], clock: "waiting" as const })),
  }
}
