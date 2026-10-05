import assert from "node:assert/strict"
import { gmbDestination } from "./gmb-destinations.ts"

const cyberport = gmbDestination(2000511, 2)
assert.equal(cyberport?.tc, "數碼港")
assert.equal(cyberport?.en, "Cyberport")

const reverse = gmbDestination(2000511, 1)
assert.equal(reverse?.tc, "銅鑼灣(駱克道)")
assert.equal(reverse?.en, "Causeway Bay (Lockhart Road)")

assert.equal(gmbDestination(999999999, 1), null)
assert.equal(gmbDestination(2000511, 9), null)

console.log("gmb destinations ok")
