import { MissingKey, callingPoints } from "@/lib/national-rail-feed"
import { errorText } from "@/lib/snapshot-route"
import type { NationalServiceResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

// The stops still ahead of one train, by its Darwin service ID.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? ""
  try {
    const calls = await callingPoints(id)
    if (!calls) return Response.json({ ok: false, error: "Service missing", calls: [] } satisfies NationalServiceResponse, { status: 400 })
    return Response.json({ ok: true, calls } satisfies NationalServiceResponse)
  } catch (error) {
    const status = error instanceof MissingKey ? 503 : 502
    return Response.json({ ok: false, error: errorText(error, "Calling points failed"), calls: [] } satisfies NationalServiceResponse, { status })
  }
}
