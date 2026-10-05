// Bus stop boards that failed to load, so the Systems tab can say which ones.
export type BoardFault = {
  id: string
  name: string
}

const faults = new Map<string, BoardFault>()
let snapshot: readonly BoardFault[] = []
const listeners = new Set<() => void>()

function publish(): void {
  snapshot = [...faults.values()]
  for (const listener of listeners) listener()
}

export function boardFaultSnapshot(): readonly BoardFault[] {
  return snapshot
}

export function subscribeBoardFaults(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function markBoardFault(fault: BoardFault): void {
  const current = faults.get(fault.id)
  if (current && current.name === fault.name) return
  faults.set(fault.id, fault)
  publish()
}

export function clearBoardFault(id: string): void {
  if (!faults.delete(id)) return
  publish()
}
