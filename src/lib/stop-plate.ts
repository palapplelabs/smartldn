export type StopPlate = {
  title: string
  lines: string[]
}

const PER_LINE = 3
const MAX_LINES = 4

export function stopPlate(name: string, routes: string[], options?: { perLine?: number; keepOrder?: boolean }): StopPlate {
  const perLine = options?.perLine ?? PER_LINE
  const seen = new Set<string>()
  const sorted: string[] = []
  for (const route of routes) {
    const trimmed = route.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    sorted.push(trimmed)
  }
  if (!options?.keepOrder) sorted.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const lines: string[] = []
  for (let index = 0; index < sorted.length && lines.length < MAX_LINES; index += perLine) {
    lines.push(sorted.slice(index, index + perLine).join(" "))
  }
  return { title: shortStopTitle(name), lines }
}

// Routes with a published destination come first, one mark each. The rest stay route numbers.
export function directedRouteMarks(routes: readonly string[], calls: readonly { route: string; dest: string }[]): { marks: string[]; directed: boolean } {
  const byRoute = new Map<string, string[]>()
  for (const call of calls) {
    const route = call.route.trim()
    const dest = call.dest.trim()
    if (!route || !dest) continue
    const list = byRoute.get(route) ?? []
    if (!list.includes(dest)) list.push(dest)
    byRoute.set(route, list)
  }
  const source = routes.length > 0 ? routes : [...byRoute.keys()]
  const directed: string[] = []
  const plain: string[] = []
  const seen = new Set<string>()
  for (const route of source) {
    const trimmed = route.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    const dests = byRoute.get(trimmed)
    if (!dests || dests.length === 0) {
      plain.push(trimmed)
      continue
    }
    for (const dest of dests) directed.push(`${trimmed} ${dest}`)
  }
  return { marks: [...directed, ...plain], directed: directed.length > 0 }
}

export function shortStopTitle(name: string): string {
  const level = name.match(/[上下]層/)
  if (level) return level[0]
  if (/upper level/i.test(name)) return "Upper"
  if (/lower level/i.test(name)) return "Lower"
  const head = name.split(/[,，]/)[0]?.trim() ?? ""
  return head.length > 18 ? `${head.slice(0, 17)}…` : head
}

export function stopPlateKey(plate: StopPlate): string {
  return `${plate.title}|${plate.lines.join("|")}`
}
