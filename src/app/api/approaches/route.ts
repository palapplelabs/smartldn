import { readApproachPoints } from "@/lib/approaches"
import { fetchUpstream } from "@/lib/upstream"
import type { ApproachesResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const LOCATIONS_URL =
  "https://www.hkemobility.gov.hk/api/drss/layer/map?service=WFS&version=1.0.0&request=GetFeature&typeName=DRSS:VW_JOURNEY_TIME_LOCATION_EN&outputFormat=application/json&srsName=EPSG:4326"

const LOCATIONS_TC_URL =
  "https://www.hkemobility.gov.hk/api/drss/layer/map?service=WFS&version=1.0.0&request=GetFeature&typeName=DRSS:VW_JOURNEY_TIME_LOCATION_TC&outputFormat=application/json&srsName=EPSG:4326"

const DETAIL_IDS = ["H1", "H2", "H3", "H4", "H11", "K02", "K03", "K07", "K08"]

const FRESH_MS = 60_000
const PLACE_MS = 24 * 60 * 60 * 1000

let pending: Promise<ApproachesResponse> | null = null
let cached: { at: number; body: ApproachesResponse } | null = null

export async function GET() {
  const now = Date.now()
  if (cached && now - cached.at < FRESH_MS) return Response.json(cached.body)
  pending ??= loadApproaches().finally(() => {
    pending = null
  })
  try {
    const body = await pending
    if (body.ok) cached = { at: Date.now(), body }
    else if (cached) return Response.json(cached.body)
    return Response.json(body, { status: body.ok ? 200 : 502 })
  } catch (error) {
    if (cached) return Response.json(cached.body)
    const body: ApproachesResponse = {
      ok: false,
      error: error instanceof Error ? error.message : "Journey time boards failed",
      capturedAt: null,
      points: [],
    }
    return Response.json(body, { status: 502 })
  }
}

let places: { at: number; locations: unknown; traditional: unknown } | null = null

async function loadApproaches(): Promise<ApproachesResponse> {
  const placed = await loadPlaces()
  const details = await Promise.all(
    DETAIL_IDS.map(async (id) => {
      try {
        return [id, await readJson(detailUrl(id))] as const
      } catch (error) {
        return [id, error instanceof Error ? error.message : "Journey time board failed"] as const
      }
    }),
  )

  const detailsById: Record<string, unknown> = {}
  const failures: string[] = []
  for (const [id, body] of details) {
    if (typeof body === "string") {
      failures.push(`${id}: ${body}`)
      continue
    }
    detailsById[id] = body
  }

  const { points, capturedAt } = readApproachPoints(placed.locations, detailsById, placed.traditional)
  return {
    ok: points.length > 0,
    error: points.length === 0 ? failures[0] ?? "No harbour-approach journey times were returned." : undefined,
    capturedAt,
    points,
  }
}

async function loadPlaces(): Promise<{ at: number; locations: unknown; traditional: unknown }> {
  const now = Date.now()
  if (places && now - places.at < PLACE_MS) return places
  try {
    const locations = await readJson(LOCATIONS_URL, PLACE_MS)
    const traditional = await readJson(LOCATIONS_TC_URL, PLACE_MS).catch(() => places?.traditional ?? null)
    places = { at: now, locations, traditional }
    return places
  } catch (error) {
    if (places) return places
    throw error
  }
}

function detailUrl(id: string): string {
  return `https://www.hkemobility.gov.hk/api/drss/getTextInfo/JourneyTime/en/${encodeURIComponent(id)}`
}

async function readJson(url: string, ttlMs = FRESH_MS): Promise<unknown> {
  const response = await fetchUpstream(url, ttlMs, {
    timeoutMs: 40_000,
    headers: {
      Accept: "application/json",
      Referer: "https://www.hkemobility.gov.hk/en/",
    },
  })
  if (response.status !== 200) throw new Error(`HTTP ${response.status} from hkemobility.gov.hk`)
  return JSON.parse(new TextDecoder().decode(response.body)) as unknown
}
