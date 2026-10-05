import assert from "node:assert/strict"
import { cachedValue } from "./board-cache.ts"

let reads = 0
const first = await cachedValue("kmb:a", 60_000, async () => {
  reads += 1
  return { ok: true, n: reads }
})
const second = await cachedValue("kmb:a", 60_000, async () => {
  reads += 1
  return { ok: true, n: 9 }
})
assert.equal(reads, 1)
assert.equal(first.n, 1)
assert.equal(second.n, 1)

let failed = 0
const miss = cachedValue("kmb:bad", 60_000, async () => {
  failed += 1
  await new Promise((resolve) => setTimeout(resolve, 20))
  return { ok: false }
})
const joined = cachedValue("kmb:bad", 60_000, async () => {
  failed += 1
  return { ok: false }
})
await Promise.all([miss, joined])
assert.equal(failed, 1)
const again = await cachedValue("kmb:bad", 60_000, async () => {
  failed += 1
  return { ok: false }
})
assert.equal(again.ok, false)
assert.equal(failed, 2)

console.log("board-cache-ok")
