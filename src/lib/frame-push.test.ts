import assert from "node:assert/strict"
import { beginPush, endPush, type PushGate } from "./frame-push.ts"

const gate: PushGate = { busy: false, at: 0 }
assert.equal(beginPush(gate, 1000, 140), true)
assert.equal(gate.busy, true)
assert.equal(beginPush(gate, 1100, 140), false)
assert.equal(gate.at, 1000)

endPush(gate)
assert.equal(beginPush(gate, 1100, 140), false)
assert.equal(beginPush(gate, 1140, 140), true)
assert.equal(beginPush(gate, 5000, 140), false)
assert.equal(gate.at, 1140)
endPush(gate)
assert.equal(beginPush(gate, 5000, 140), true)

const desktop: PushGate = { busy: false, at: 0 }
assert.equal(beginPush(desktop, 50, 0), true)
endPush(desktop)
assert.equal(beginPush(desktop, 50, 0), true)
