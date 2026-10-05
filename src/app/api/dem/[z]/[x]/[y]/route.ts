import { repairTerrariumPng } from "@/lib/terrain-tile"
import { fetchUpstream } from "@/lib/upstream"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await context.params
  const zN = Number(z)
  const xN = Number(x)
  const yN = Number(y.replace(/\.png$/i, ""))
  if (!Number.isInteger(zN) || zN < 0 || zN > 15) {
    return new Response("Tile zoom out of range", { status: 400 })
  }
  const limit = 2 ** zN
  if (!Number.isInteger(xN) || !Number.isInteger(yN) || xN < 0 || yN < 0 || xN >= limit || yN >= limit) {
    return new Response("Tile index out of range", { status: 400 })
  }

  const upstream = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zN}/${xN}/${yN}.png`
  const response = await fetchUpstream(upstream, 86_400_000, { timeoutMs: 20_000 })
  if (response.status !== 200) return new Response(null, { status: response.status })
  const bytes = Buffer.from(response.body)
  const repaired = repairTerrariumPng(bytes, zN)
  return new Response(new Uint8Array(repaired), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
