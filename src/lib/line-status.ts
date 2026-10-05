import type { LiftOutage, LineStatus, LineTone } from "./types.ts"

// TfL status severities are codes, not a scale. These stop or cut a line.
const RED = new Set([1, 2, 3, 5, 6, 11, 16])
// These change a journey without stopping the line.
const AMBER = new Set([4, 7, 8, 9, 12, 13, 14, 15, 17, 19, 20])

export function toneOf(severity: number): LineTone {
  if (RED.has(severity)) return "red"
  if (AMBER.has(severity)) return "amber"
  return "green"
}

const TONE_RANK: Record<LineTone, number> = { green: 0, amber: 1, red: 2 }

export function parseLineStatus(rows: Record<string, unknown>[], colorOf: (id: string) => string): LineStatus[] {
  return rows.flatMap((row) => {
    const id = str(row, "id")
    if (!id) return []
    const statuses = Array.isArray(row.lineStatuses)
      ? row.lineStatuses.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      : []
    let worst: { severity: number; status: string; reason: string; tone: LineTone } | null = null
    for (const item of statuses) {
      const severity = typeof item.statusSeverity === "number" ? item.statusSeverity : 10
      const tone = toneOf(severity)
      if (!worst || TONE_RANK[tone] > TONE_RANK[worst.tone]) {
        worst = { severity, status: str(item, "statusSeverityDescription"), reason: str(item, "reason"), tone }
      }
    }
    const chosen = worst ?? { severity: 10, status: "Good Service", reason: "", tone: "green" as const }
    return [
      {
        id,
        name: str(row, "name") || id,
        mode: str(row, "modeName"),
        color: colorOf(id),
        severity: chosen.severity,
        status: chosen.status || "Good Service",
        reason: chosen.reason,
        tone: chosen.tone,
      },
    ]
  })
}

export function parseLifts(rows: Record<string, unknown>[], nameOf: (code: string) => string | null): LiftOutage[] {
  return rows.flatMap((row) => {
    const code = str(row, "stationUniqueId")
    const message = str(row, "message")
    if (!code || !message) return []
    return [{ station: nameOf(code) ?? stationFromMessage(message) ?? code, message }]
  })
}

// "WEMBLEY PARK STATION: From Monday …" → "Wembley Park"
function stationFromMessage(message: string): string | null {
  const head = message.split(":")[0]?.replace(/\s+STATION$/i, "").trim()
  if (!head || head.length > 48) return null
  return head.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function str(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  return typeof value === "string" ? value.trim() : ""
}
