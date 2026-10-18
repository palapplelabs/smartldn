import assert from "node:assert/strict"
import { beginPush, endPush, pushReady, type PushGate } from "./frame-push.ts"

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

const phone: PushGate = { busy: false, at: 0 }
assert.equal(pushReady(phone, 100, 100), true)
assert.equal(beginPush(phone, 100, 100), true)
assert.equal(pushReady(phone, 150, 100), false)
endPush(phone)
assert.equal(pushReady(phone, 150, 100), false)
assert.equal(pushReady(phone, 200, 100), true)
