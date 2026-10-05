type OkBody = { ok: boolean; error?: string }

// One shared reading per feed. A failed read keeps serving the last good one, so
// a slow minute upstream does not blank the map for everyone.
export function snapshotGet<T extends OkBody>(options: {
  freshMs: number
  load: (now: number) => Promise<T>
  failed: (error: unknown) => T
}): () => Promise<Response> {
  let cached: { at: number; body: T } | null = null
  let pending: Promise<T> | null = null
  return async function GET() {
    const now = Date.now()
    if (cached && now - cached.at < options.freshMs) return Response.json(cached.body)
    pending ??= options.load(now).finally(() => {
      pending = null
    })
    try {
      const body = await pending
      if (body.ok) cached = { at: Date.now(), body }
      else if (cached) return Response.json(cached.body)
      return Response.json(body, { status: body.ok ? 200 : 502 })
    } catch (error) {
      if (cached) return Response.json(cached.body)
      return Response.json(options.failed(error), { status: 502 })
    }
  }
}

export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
