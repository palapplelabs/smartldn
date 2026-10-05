type OkBody = { ok: boolean; cacheable?: boolean }

export function viewCachedGet<T extends OkBody>(options: {
  freshMs: number
  load: (lng: number, lat: number, now: number, zoom: number) => Promise<T>
  missing: () => T
  failed: (error: unknown) => T
  cacheKey?: (lng: number, lat: number, zoom: number) => string
}): (request: Request) => Promise<Response> {
  const cached = new Map<string, { at: number; body: T }>()
  return async function GET(request: Request) {
    const url = new URL(request.url)
    const lng = Number(url.searchParams.get("lng"))
    const lat = Number(url.searchParams.get("lat"))
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return Response.json(options.missing(), { status: 400 })
    }
    const zoom = Number(url.searchParams.get("zoom"))
    const key = options.cacheKey
      ? options.cacheKey(lng, lat, zoom)
      : `${lng.toFixed(3)},${lat.toFixed(3)}`
    const now = Date.now()
    const hit = cached.get(key)
    if (hit && now - hit.at < options.freshMs) return Response.json(hit.body)
    try {
      const body = await options.load(lng, lat, now, zoom)
      if (body.ok && body.cacheable !== false) cached.set(key, { at: Date.now(), body })
      else if (!body.ok && hit) return Response.json(hit.body)
      return Response.json(body, { status: body.ok ? 200 : 502 })
    } catch (error) {
      if (hit) return Response.json(hit.body)
      return Response.json(options.failed(error), { status: 502 })
    }
  }
}
