import type { Corridor, CorridorSummary, SpeedBand } from "./types.ts"

export type CorridorShapes = Record<string, { name: string; paths: [number, number][][] }>

// TfL corridor severities: Good, Serious, Severe, Closure. Anything else is unknown.
export function bandOf(severity: string): SpeedBand {
  switch (severity.trim().toLowerCase()) {
    case "good":
      return "free"
    case "serious":
      return "slow"
    case "severe":
    case "closure":
      return "congested"
    default:
      return "unknown"
  }
}

export function corridorsFromStatus(rows: Record<string, unknown>[], shapes: CorridorShapes): Corridor[] {
  return rows.flatMap((row) => {
    const id = typeof row.id === "string" ? row.id : ""
    if (!id) return []
    const shape = shapes[id]
    const severity = typeof row.statusSeverity === "string" ? row.statusSeverity : ""
    const detail = typeof row.statusSeverityDescription === "string" ? row.statusSeverityDescription : ""
    const name = typeof row.displayName === "string" && row.displayName ? row.displayName : shape?.name ?? id
    return [
      {
        id,
        name,
        status: severity || "Unknown",
        detail,
        band: bandOf(severity),
        closed: severity.trim().toLowerCase() === "closure",
        paths: shape?.paths ?? [],
      },
    ]
  })
}

export function summarize(corridors: Corridor[]): CorridorSummary {
  const summary: CorridorSummary = { free: 0, slow: 0, congested: 0, unknown: 0 }
  for (const corridor of corridors) summary[corridor.band] += 1
  return summary
}
