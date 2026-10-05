import type { WatchLayer } from "@/lib/types"

const CROWDED_PINS: ReadonlySet<WatchLayer> = new Set(["kmb"])

export const KMB_MIN_ZOOM = 13
// Green minibuses stay at the nearest 24. That circle still holds more than 24 until the map is this close.
export const GMB_MIN_ZOOM = 17
// A single quieter layer can appear from the city view. KMB stays closer because the stops cover the map.
export const SOLO_PIN_ZOOM = 10
export const KMB_POLL_MS = 60_000
export const PLACE_POLL_MS = 12 * 60 * 60 * 1000

export function placePinZoom(layer: WatchLayer, sole: WatchLayer | null): number {
  const normal = layer === "gmb" ? GMB_MIN_ZOOM : KMB_MIN_ZOOM
  if (sole !== layer || CROWDED_PINS.has(layer)) return normal
  return Math.min(normal, SOLO_PIN_ZOOM)
}

export function mapViewKey(lng: number, lat: number, zoom: number): string {
  if (!Number.isFinite(zoom) || zoom < SOLO_PIN_ZOOM) return "far"
  const band = zoom < KMB_MIN_ZOOM ? "overview" : zoom < 16 ? "wide" : zoom < GMB_MIN_ZOOM ? "street" : "close"
  return `${lng.toFixed(3)},${lat.toFixed(3)},${band}`
}
