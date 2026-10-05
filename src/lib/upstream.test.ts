import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { register } from "node:module"

const hook = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = new URL("../" + specifier.slice(2) + ".ts", ${JSON.stringify(import.meta.url)})
    return nextResolve(target.href, context)
  }
  return nextResolve(specifier, context)
}
`
register(`data:text/javascript,${encodeURIComponent(hook)}`)

const { fetchUpstream } = await import("./upstream.ts")

type FetchInit = { cf?: { cacheTtl?: number; cacheEverything?: boolean } }

let fetches = 0
let puts = 0
let hangPut = false
const hits = new Set<string>()

globalThis.caches = {
  default: {
    async match(request: Request) {
      if (!hits.has(request.url)) return undefined
      return new Response(JSON.stringify({ from: "cache" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    },
    async put(request: Request) {
      puts += 1
      hits.add(request.url)
      if (hangPut) await new Promise(() => {})
    },
  },
} as unknown as CacheStorage

globalThis.fetch = (async (input: RequestInfo | URL, init?: FetchInit) => {
  fetches += 1
  if (init?.cf?.cacheTtl || init?.cf?.cacheEverything) hangPut = true
  const url = String(input)
  const status = url.endsWith("/down") ? 503 : 200
  return new Response(JSON.stringify({ from: "network" }), {
    status,
    headers: { "content-type": "application/json" },
  })
}) as typeof fetch

const live = "https://rt.data.gov.hk/v2/transport/citybus/eta/example"
const raced = await Promise.race([
  fetchUpstream(live, 60_000),
  new Promise<null>((resolve) => setTimeout(() => resolve(null), 300)),
])
assert.ok(raced)
assert.equal(hangPut, false)
assert.equal(fetches, 1)
assert.equal(puts, 1)
assert.equal(new TextDecoder().decode(raced.body).includes("network"), true)

await fetchUpstream(live, 60_000)
assert.equal(fetches, 1)

const cachedUrl = "https://rt.data.gov.hk/v2/transport/citybus/eta/cached"
hits.add(cachedUrl)
const cached = await fetchUpstream(cachedUrl, 60_000)
assert.equal(fetches, 1)
assert.equal(new TextDecoder().decode(cached.body).includes("cache"), true)

const down = await fetchUpstream("https://rt.data.gov.hk/v2/transport/citybus/eta/down", 60_000)
assert.equal(down.status, 503)
assert.equal(puts, 1)

const memory = readFileSync(new URL("./mtr-feed.ts", import.meta.url), "utf8")
assert.match(memory, /const MEMORY_URL = "https:\/\/hktraffic-cache\.invalid\/mtr-board-memory"/)
assert.equal(memory.includes("https://hktraffic.keith-li.workers.dev/internal/"), false)

console.log("upstream cache ok")
