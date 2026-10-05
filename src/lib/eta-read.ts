import { ETA_FRESH_MS } from "@/lib/place-arrivals"
import { etaQueue } from "@/lib/polite-fetch"
import { fetchUpstream } from "@/lib/upstream"

const ETA_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; HKTrafficIntelligence/1.0; +https://hktraffic.keith-li.workers.dev)",
}

export async function readEtaJson<T>(url: string, blank: T | null = null): Promise<T | null> {
  try {
    const response = await etaQueue(() => fetchUpstream(url, ETA_FRESH_MS, {
      timeoutMs: 5_000,
      headers: ETA_HEADERS,
    }))
    if (response.status !== 200) return null
    const text = new TextDecoder().decode(response.body)
    if (!text) return blank
    return JSON.parse(text) as T
  } catch {
    return null
  }
}
