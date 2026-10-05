import assert from "node:assert/strict"
import { viewCachedGet } from "./view-cache.ts"

const request = new Request("http://local/api/kmb?lng=114.196&lat=22.383&zoom=16.5")

let generation = 0
const partial = viewCachedGet({
  freshMs: 60_000,
  load: async () => {
    generation += 1
    return { ok: true, cacheable: false, generation }
  },
  missing: () => ({ ok: false, generation: 0 }),
  failed: () => ({ ok: false, generation: 0 }),
})

const first = await partial(request).then((response) => response.json()) as { generation: number }
const second = await partial(request).then((response) => response.json()) as { generation: number }
assert.equal(first.generation, 1)
assert.equal(second.generation, 2)

let stored = 0
const stable = viewCachedGet({
  freshMs: 60_000,
  load: async () => {
    stored += 1
    return { ok: true, stored }
  },
  missing: () => ({ ok: false, stored: 0 }),
  failed: () => ({ ok: false, stored: 0 }),
})
const saved = new Request("http://local/api/kmb?lng=114.2&lat=22.3")
const once = await stable(saved).then((response) => response.json()) as { stored: number }
const twice = await stable(saved).then((response) => response.json()) as { stored: number }
assert.equal(once.stored, 1)
assert.equal(twice.stored, 1)
assert.equal(stored, 1)
