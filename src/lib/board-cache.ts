type Entry<T> = { at: number; value: T }

const boards = new Map<string, Entry<unknown>>()
const pending = new Map<string, Promise<unknown>>()

// One board per stop. A failed read is not kept, so the next open can try again.
export function cachedValue<T extends { ok: boolean }>(key: string, ttlMs: number, load: () => Promise<T>, now = Date.now()): Promise<T> {
  const hit = boards.get(key) as Entry<T> | undefined
  if (hit && now - hit.at < ttlMs) return Promise.resolve(hit.value)
  const current = pending.get(key) as Promise<T> | undefined
  if (current) return current
  const task = load()
    .then((value) => {
      if (value.ok) boards.set(key, { at: Date.now(), value })
      return value
    })
    .finally(() => {
      if (pending.get(key) === task) pending.delete(key)
    })
  pending.set(key, task)
  return task
}
