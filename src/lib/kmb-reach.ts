import { metresPerPixel } from "./nearest.ts"

const STOP_CAP = 40
const MIN_RADIUS_M = 350
const VIEW_RADIUS_PX = 1_200

export { STOP_CAP }

export function kmbReachMetres(zoom: number, lat: number): number {
  if (!Number.isFinite(zoom)) return 450
  return Math.max(MIN_RADIUS_M, metresPerPixel(zoom, lat) * VIEW_RADIUS_PX)
}

export function kmbCacheKey(lng: number, lat: number, zoom: number): string {
  return `${lng.toFixed(3)},${lat.toFixed(3)},${Math.round(kmbReachMetres(zoom, lat) / 50)}`
}

export function isListedKmbRow(row: { eta_seq?: number; route?: string }): boolean {
  return row.eta_seq === 1 && Boolean(row.route?.trim())
}
