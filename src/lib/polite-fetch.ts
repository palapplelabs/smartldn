function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function politeQueue(limit: number) {
  let active = 0
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    while (active >= limit) await pause(20)
    active += 1
    try {
      return await task()
    } finally {
      active -= 1
    }
  }
}

let refreshing = false
const TURN_WAIT_MS = 12_000

export async function takeEtaTurn<T>(task: () => Promise<T>): Promise<T | null> {
  const started = Date.now()
  while (refreshing && Date.now() - started < TURN_WAIT_MS) await pause(40)
  if (refreshing) return null
  refreshing = true
  try {
    return await task()
  } finally {
    refreshing = false
  }
}

export const ETA_QUEUE_LIMIT = 6

export const etaQueue = politeQueue(ETA_QUEUE_LIMIT)
