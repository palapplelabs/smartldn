import { loadLrtSnapshot } from "@/lib/lrt-feed"
import type { LrtResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const FRESH_MS = 15_000

let pending: Promise<LrtResponse> | null = null
let cached: { at: number; body: LrtResponse } | null = null

export async function GET() {
  const now = Date.now()
  if (cached && now - cached.at < FRESH_MS) return Response.json(cached.body)
  const current = pending ?? loadLrtSnapshot(now).finally(() => {
    pending = null
  })
  pending = current
  try {
    const body = await current
    if (body.ok) cached = { at: Date.now(), body }
    else if (cached) return Response.json(cached.body)
    return Response.json(body, { status: body.ok ? 200 : 502 })
  } catch (error) {
    if (cached) return Response.json(cached.body)
    const body: LrtResponse = {
      ok: false,
      error: error instanceof Error ? error.message : "Light Rail arrivals failed",
      observedAt: null,
      trains: [],
      boards: [],
    }
    return Response.json(body, { status: 502 })
  }
}
