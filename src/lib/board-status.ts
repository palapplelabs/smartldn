import type { Messages } from "./i18n.ts"
import type { StopOperator } from "./stop-board.ts"

export type BoardFault = {
  operator: StopOperator
  id: string
  name: string
}

const faults = new Map<string, BoardFault>()
let snapshot: readonly BoardFault[] = []
const listeners = new Set<() => void>()

function faultKey(operator: StopOperator, id: string): string {
  return `${operator}:${id}`
}

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
  const key = faultKey(fault.operator, fault.id)
  const current = faults.get(key)
  if (current && current.name === fault.name) return
  faults.set(key, fault)
  publish()
}

export function clearBoardFault(operator: StopOperator, id: string): void {
  if (!faults.delete(faultKey(operator, id))) return
  publish()
}

export function boardFailedCopy(operator: StopOperator, m: Messages): string {
  switch (operator) {
    case "kmb":
      return m.kmbFailed
    case "citybus":
      return m.citybusFailed
    case "gmb":
      return m.gmbFailed
    case "nlb":
      return m.nlbFailed
    default: {
      const exhaustive: never = operator
      return exhaustive
    }
  }
}
