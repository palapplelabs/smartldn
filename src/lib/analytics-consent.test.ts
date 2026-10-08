import assert from "node:assert/strict"
import { readConsent } from "./analytics-consent.ts"

assert.equal(readConsent("granted"), "granted")
assert.equal(readConsent("denied"), "denied")
assert.equal(readConsent(null), "unset")
assert.equal(readConsent("yes"), "unset")

console.log("analytics-consent ok")
