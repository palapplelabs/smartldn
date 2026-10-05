// Stops listed for the view have no arrivals until a card is opened, so each one
// starts with an empty board.
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
