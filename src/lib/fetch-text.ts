import { fetchUpstream } from "@/lib/upstream"

export async function fetchText(url: string, ttlMs: number): Promise<string> {
  const result = await fetchUpstream(url, ttlMs)
  if (result.status !== 200) throw new Error(`HTTP ${result.status} from ${hostOf(url)}`)
  return new TextDecoder().decode(result.body)
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
