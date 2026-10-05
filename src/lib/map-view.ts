import type { WatchLayer } from "@/lib/types"

// Bus stops cover the whole city, so they wait for a street-level view.
const CROWDED_PINS: ReadonlySet<WatchLayer> = new Set(["bus"])

export type MapView = { lng: number; lat: number; zoom: number; bounds: [number, number, number, number] }

export const STOP_MIN_ZOOM = 14
// Live buses join the map at district zoom; a whole-London view would be ~6,000 dots.
export const BUS_MIN_ZOOM = 12
export const PLANNING_MIN_ZOOM = 14
// A single quieter layer can appear from the city view.
export const SOLO_PIN_ZOOM = 11
export const PLACE_POLL_MS = 12 * 60 * 60 * 1000

export function placePinZoom(layer: WatchLayer, sole: WatchLayer | null): number {
  const normal = layer === "planning" ? PLANNING_MIN_ZOOM : STOP_MIN_ZOOM
  if (sole !== layer || CROWDED_PINS.has(layer)) return normal
  return Math.min(normal, SOLO_PIN_ZOOM)
}

export function mapViewKey(lng: number, lat: number, zoom: number): string {
  if (!Number.isFinite(zoom) || zoom < SOLO_PIN_ZOOM) return "far"
  const band = zoom < STOP_MIN_ZOOM ? "overview" : zoom < 16 ? "wide" : zoom < 17 ? "street" : "close"
  // The half-step zoom keeps the view's bounds current for the live bus slice.
  return `${lng.toFixed(3)},${lat.toFixed(3)},${band},${Math.round(zoom * 2) / 2}`
}

// Rounded outwards to about a kilometre, so small pans share one request.
export function busViewQuery(view: MapView): string {
  const [west, south, east, north] = view.bounds
  const down = (value: number) => (Math.floor(value * 100) / 100).toFixed(2)
  const up = (value: number) => (Math.ceil(value * 100) / 100).toFixed(2)
  return `w=${down(west)}&s=${down(south)}&e=${up(east)}&n=${up(north)}`
}
