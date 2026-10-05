export type PushGate = {
  busy: boolean
  at: number
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
