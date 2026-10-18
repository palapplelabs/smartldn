export type PushGate = {
  busy: boolean
  at: number
}

// Whether beginPush would accept now, so a caller can skip building data it
// would not be allowed to send.
export function pushReady(gate: PushGate, now: number, gapMs: number): boolean {
  return !gate.busy && now - gate.at >= gapMs
}

export function beginPush(gate: PushGate, now: number, gapMs: number): boolean {
  if (gate.busy) return false
  if (now - gate.at < gapMs) return false
  gate.busy = true
  gate.at = now
  return true
}

export function endPush(gate: PushGate): void {
  gate.busy = false
}
