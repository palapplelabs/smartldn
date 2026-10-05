const METRES_PER_PIXEL_AT_EQUATOR = 156_543.03392
const EAST_METRES = 111_320
const NORTH_METRES = 110_540

export function metresPerPixel(zoom: number, lat: number): number {
  return (METRES_PER_PIXEL_AT_EQUATOR * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
}

export function groundMetres(lng: number, lat: number, otherLng: number, otherLat: number): number {
  const cos = Math.cos((lat * Math.PI) / 180)
  const east = (otherLng - lng) * cos * EAST_METRES
  const north = (otherLat - lat) * NORTH_METRES
  return Math.hypot(east, north)
}

export function pointsWithin<T extends { lng: number; lat: number }>(
  points: readonly T[],
  lng: number,
  lat: number,
  radiusMetres: number,
  limit: number,
): T[] {
  return points
    .map((point) => ({ point, distance: groundMetres(lng, lat, point.lng, point.lat) }))
    .filter((item) => item.distance <= radiusMetres)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((item) => item.point)
}

export function nearestMetres<T extends { lng: number; lat: number }>(
  points: readonly T[],
  lng: number,
  lat: number,
  limit: number,
): T[] {
  return pointsWithin(points, lng, lat, Number.POSITIVE_INFINITY, limit)
}

export function nearestPoints<T extends { lng: number; lat: number }>(
  points: readonly T[],
  lng: number,
  lat: number,
  limit: number,
): T[] {
  const cos = Math.cos((lat * Math.PI) / 180)
  return points
    .map((point) => {
      const x = (point.lng - lng) * cos
      const y = (point.lat - lat)
      return { point, distance: x * x + y * y }
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((item) => item.point)
}
