import { fetchUpstream } from "@/lib/upstream"

const TFL = "https://api.tfl.gov.uk"

// Without a key TfL allows about 50 requests a minute from one address. Every
// feed is read once per refresh for all visitors, so a key mostly buys headroom.
export function tflUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(path, TFL)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const key = process.env.TFL_APP_KEY
  if (key) url.searchParams.set("app_key", key)
  return url.toString()
}

export async function tflJson(path: string, ttlMs: number, params: Record<string, string> = {}): Promise<unknown> {
  const result = await fetchUpstream(tflUrl(path, params), ttlMs, {
    timeoutMs: 20_000,
    headers: { Accept: "application/json" },
  })
  if (result.status !== 200) throw new Error(`HTTP ${result.status} from TfL ${path}`)
  return JSON.parse(new TextDecoder().decode(result.body)) as unknown
}

export function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
}

export function text(row: Record<string, unknown> | null | undefined, key: string): string {
  const value = row?.[key]
  return typeof value === "string" ? value.trim() : ""
}

export function num(row: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = row?.[key]
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

// Place records carry their details as a key/value list.
export function additional(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const item of records(row.additionalProperties)) {
    const key = text(item, "key")
    if (key) out[key] = text(item, "value")
  }
  return out
}
