export function nextReading<T extends { ok: boolean }>(current: T | null, incoming: T): T {
  if (incoming.ok) return incoming
  if (current?.ok) return current
  return incoming
}
