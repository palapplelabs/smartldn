import { camerasFromPlaces } from "@/lib/jamcams"
import { errorText, snapshotGet } from "@/lib/snapshot-route"
import { additional, num, records, text, tflJson } from "@/lib/tfl"
import type { CamerasResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

export const GET = snapshotGet<CamerasResponse>({
  freshMs: 5 * 60_000,
  async load() {
    const rows = records(await tflJson("/Place/Type/JamCam", 5 * 60_000))
    const places = rows.flatMap((row) => {
      const lng = num(row, "lon")
      const lat = num(row, "lat")
      if (lng == null || lat == null) return []
      return [{ id: text(row, "id"), name: text(row, "commonName"), lng, lat, props: additional(row) }]
    })
    return { ok: true, cameras: camerasFromPlaces(places) }
  },
  failed: (error) => ({ ok: false, error: errorText(error, "Cameras failed"), cameras: { type: "FeatureCollection", features: [] } }),
})
