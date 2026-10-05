export function routesWithoutArrival(routes: readonly string[], arrived: readonly string[]): string[] {
  const seen = new Set(arrived.map((route) => route.trim()).filter(Boolean))
  const pending: string[] = []
  const listed = new Set<string>()
  for (const route of routes) {
    const trimmed = route.trim()
    if (!trimmed || seen.has(trimmed) || listed.has(trimmed)) continue
    listed.add(trimmed)
    pending.push(trimmed)
  }
  pending.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  return pending
}
