import { metresPerPixel } from "./nearest.ts"

const MIN_RADIUS_M = 350
const VIEW_RADIUS_PX = 1_200

// How far around the map centre to list stops: about the visible screen, never
// smaller than a short walk.
export function stopReachMetres(zoom: number, lat: number): number {
  if (!Number.isFinite(zoom)) return 450
  return Math.max(MIN_RADIUS_M, metresPerPixel(zoom, lat) * VIEW_RADIUS_PX)
}

export function viewCacheKey(lng: number, lat: number, zoom: number): string {
  return `${lng.toFixed(3)},${lat.toFixed(3)},${Math.round(stopReachMetres(zoom, lat) / 50)}`
}

// Greater London with a margin. Stop and planning searches outside it are not
// sent upstream, so a stray request cannot spend the shared TfL allowance.
const LONDON = { west: -0.56, south: 51.26, east: 0.35, north: 51.71 }

export function inLondon(lng: number, lat: number): boolean {
  return lng >= LONDON.west && lng <= LONDON.east && lat >= LONDON.south && lat <= LONDON.north
}
