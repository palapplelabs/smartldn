import { loadCitybusBoard } from "@/lib/citybus-feed"
import { loadGmbBoard } from "@/lib/gmb-feed"
import { loadKmbBoard } from "@/lib/kmb-feed"
import { loadNlbBoard } from "@/lib/nlb-feed"
import type { CitybusStopBoard, KmbStopBoard } from "@/lib/types"

export const STOP_OPERATORS = ["kmb", "citybus", "gmb", "nlb"] as const

export type StopOperator = (typeof STOP_OPERATORS)[number]

export type StopBoard = KmbStopBoard | CitybusStopBoard

export function isStopOperator(value: string | null): value is StopOperator {
  return value === "kmb" || value === "citybus" || value === "gmb" || value === "nlb"
}

export function loadStopBoard(op: StopOperator, id: string): Promise<{ ok: true; stop: StopBoard } | { ok: false }> {
  switch (op) {
    case "kmb":
      return loadKmbBoard(id)
    case "citybus":
      return loadCitybusBoard(id)
    case "gmb":
      return loadGmbBoard(id)
    case "nlb":
      return loadNlbBoard(id)
    default: {
      const exhaustive: never = op
      return exhaustive
    }
  }
}
