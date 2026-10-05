import { controlPointFeatures, isQueueFile } from "@/lib/control-points"
import { fetchUpstream } from "@/lib/upstream"
import type { ControlPointsResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const RESIDENT_URL = "https://secure1.info.gov.hk/immd/mobileapps/2bb9ae17/data/CPQueueTimeR.json"
const VISITOR_URL = "https://secure1.info.gov.hk/immd/mobileapps/2bb9ae17/data/CPQueueTimeV.json"

export async function GET() {
  try {
    const [resident, visitor] = await Promise.all([readQueue(RESIDENT_URL), readQueue(VISITOR_URL)])
    const body: ControlPointsResponse = {
      ok: true,
      observedAt: new Date().toISOString(),
      points: { type: "FeatureCollection", features: controlPointFeatures(resident, visitor) },
    }
    return Response.json(body)
  } catch (error) {
    const body: ControlPointsResponse = {
      ok: false,
      error: error instanceof Error ? error.message : "Control point waiting times failed",
      observedAt: null,
      points: { type: "FeatureCollection", features: [] },
    }
    return Response.json(body, { status: 502 })
  }
}

async function readQueue(url: string) {
  const response = await fetchUpstream(url, 60_000, { timeoutMs: 15_000, headers: { Accept: "application/json" } })
  if (response.status !== 200) throw new Error(`HTTP ${response.status} from Immigration Department`)
  const payload: unknown = JSON.parse(new TextDecoder().decode(response.body))
  if (!isQueueFile(payload)) throw new Error("Control point waiting times were not in the published shape")
  return payload
}
