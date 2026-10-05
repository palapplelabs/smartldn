export function pointKey(lng: number, lat: number): string {
  return `${lng.toFixed(6)},${lat.toFixed(6)}`
}

export function indexPoints(stops: readonly { id: string; lng: number; lat: number }[]): Map<string, string[]> {
  const index = new Map<string, string[]>()
  for (const stop of stops) {
    const key = pointKey(stop.lng, stop.lat)
    const list = index.get(key)
    if (list) list.push(stop.id)
    else index.set(key, [stop.id])
  }
  return index
}

export function mates(index: ReadonlyMap<string, string[]>, id: string, lng: number, lat: number): string[] {
  return index.get(pointKey(lng, lat)) ?? [id]
}
