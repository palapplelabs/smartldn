import type { BusVehicle } from "./types.ts"

// A bus reports every 10 to 30 seconds. Between reports its dot glides from where
// it is drawn now to the newest position over one refresh, so it never jumps.
export const GLIDE_MS = 20_000
// Further than this between reports is a new journey or a GPS glitch: snap.
const SNAP_METRES = 1_500

export type BusMotion = {
  vehicle: BusVehicle
  from: [number, number]
  to: [number, number]
  start: number
}

export type BusMotions = ReadonlyMap<string, BusMotion>

export function noBusMotion(): BusMotions {
  return new Map()
}

export function syncBusMotion(previous: BusMotions, vehicles: readonly BusVehicle[], now: number): BusMotions {
  const next = new Map<string, BusMotion>()
  for (const vehicle of vehicles) {
    const to: [number, number] = [vehicle.lng, vehicle.lat]
    const before = previous.get(vehicle.id)
    if (before && before.vehicle.at === vehicle.at) {
      next.set(vehicle.id, { ...before, vehicle })
      continue
    }
    const here = before ? busPosition(before, now) : to
    const snap = metres(here, to) > SNAP_METRES
    next.set(vehicle.id, { vehicle, from: snap ? to : here, to, start: now })
  }
  return next
}

export function busPosition(motion: BusMotion, now: number): [number, number] {
  const mix = Math.min(1, Math.max(0, (now - motion.start) / GLIDE_MS))
  return [motion.from[0] + (motion.to[0] - motion.from[0]) * mix, motion.from[1] + (motion.to[1] - motion.from[1]) * mix]
}

export function busMotionCollection(motions: BusMotions, now: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const motion of motions.values()) {
    const { vehicle } = motion
    features.push({
      type: "Feature",
      properties: { id: vehicle.id, route: vehicle.route, dest: vehicle.dest, operator: vehicle.operator, at: vehicle.at },
      geometry: { type: "Point", coordinates: busPosition(motion, now) },
    })
  }
  return { type: "FeatureCollection", features }
}

function metres(a: [number, number], b: [number, number]): number {
  const east = (b[0] - a[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180)
  const north = (b[1] - a[1]) * 110_540
  return Math.hypot(east, north)
}
