import { pointKey } from "./point-index.ts"
import type { ArrivalClock } from "./types.ts"

type Call = {
  route: string
  destTc: string
  destEn: string
  minutes: number | null
}

type Pole = {
  id: string
  nameTc: string
  nameEn: string
  lng: number
  lat: number
  routes: string[]
  calls?: Call[]
  clock?: ArrivalClock
}

const CODE_TAIL = /^(.*?)\s*\(([^)]+)\)\s*$/

function sharedName(names: string[], codeJoin: string, nameJoin: string): string {
  const unique: string[] = []
  for (const name of names) {
    const trimmed = name.trim()
    if (!trimmed || unique.includes(trimmed)) continue
    unique.push(trimmed)
  }
  if (unique.length === 0) return ""
  if (unique.length === 1) return unique[0] ?? ""
  const parsed = unique.map((name) => {
    const match = CODE_TAIL.exec(name)
    if (!match) return { base: name, code: "" }
    return { base: match[1]?.trim() ?? name, code: match[2]?.trim() ?? "" }
  })
  const bases = new Set(parsed.map((item) => item.base))
  const base = parsed[0]?.base ?? ""
  if (bases.size === 1 && base) {
    const codes = [...new Set(parsed.map((item) => item.code).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    if (codes.length === 0) return base
    return `${base} (${codes.join(codeJoin)})`
  }
  return unique.join(nameJoin)
}

function mergeCalls<T extends Call>(calls: T[]): T[] {
  const best = new Map<string, T>()
  for (const call of calls) {
    const key = `${call.route}|${call.destTc}|${call.destEn}`
    const current = best.get(key)
    if (!current || (call.minutes ?? 1_000_000) < (current.minutes ?? 1_000_000)) best.set(key, call)
  }
  return [...best.values()].sort((a, b) => (a.minutes ?? 999) - (b.minutes ?? 999) || a.route.localeCompare(b.route, undefined, { numeric: true }))
}

// Records that share a coordinate are one pin. The name lists every stop code at that point.
export function mergeSamePoles<T extends Pole>(stops: T[]): T[] {
  const order: string[] = []
  const groups = new Map<string, T[]>()
  for (const stop of stops) {
    const key = pointKey(stop.lng, stop.lat)
    const list = groups.get(key)
    if (!list) {
      groups.set(key, [stop])
      order.push(key)
    } else list.push(stop)
  }
  return order.map((key) => {
    const group = [...(groups.get(key) ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1))
    const head = group[0]
    if (!head) return group[0] as T
    const routes = [...new Set(group.flatMap((stop) => stop.routes))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    const clocks = group.map((stop) => stop.clock).filter((clock): clock is ArrivalClock => clock != null)
    const clock = clocks.length === 0 ? undefined : clocks.includes("waiting") ? "waiting" : "ready"
    const calls = group.some((stop) => stop.calls) ? mergeCalls(group.flatMap((stop) => stop.calls ?? [])) : undefined
    return {
      ...head,
      nameTc: sharedName(group.map((stop) => stop.nameTc), "、", "、"),
      nameEn: sharedName(group.map((stop) => stop.nameEn), ", ", " / "),
      routes,
      ...(calls ? { calls } : {}),
      ...(clock ? { clock } : {}),
    }
  })
}
