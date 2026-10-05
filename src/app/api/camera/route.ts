import { isCameraSnapshotUrl } from "@/lib/picture"
import { fetchUpstream } from "@/lib/upstream"

export const dynamic = "force-dynamic"

const FRESH_MS = 10_000

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") ?? ""
  if (!isCameraSnapshotUrl(url)) return new Response("Camera address rejected", { status: 400 })
  const result = await fetchUpstream(url, FRESH_MS, { timeoutMs: 15_000, headers: { Accept: "image/jpeg" } })
  if (result.status !== 200) return new Response(null, { status: result.status })
  return new Response(result.body, {
    headers: {
      "Content-Type": result.contentType || "image/jpeg",
      "Cache-Control": "public, max-age=10",
    },
  })
}
