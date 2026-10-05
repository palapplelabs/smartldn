import assert from "node:assert/strict"
import { CHANGELOG } from "./changelog.ts"

// Entries are for readers of the map, so plumbing words stay out of them.
const hidden = ["token", "cache", "429", "html", "worker", "isolate", "oauth"]
assert.ok(CHANGELOG.length > 0)
const ids = new Set<string>()
for (const entry of CHANGELOG) {
  assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/)
  assert.ok(entry.text.length > 12)
  assert.equal(ids.has(entry.id), false, `duplicate ${entry.id}`)
  ids.add(entry.id)
  const blob = entry.text.toLowerCase()
  for (const word of hidden) assert.equal(blob.includes(word), false, `${entry.id} ${word}`)
}

console.log("changelog ok")
