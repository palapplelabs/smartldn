"use client"

import { useEffect, useState } from "react"
import { withBase } from "@/lib/base-path"
import { nextReading } from "@/lib/last-reading"
import { politeQueue } from "@/lib/polite-fetch"

const arrivalLane = politeQueue(1)

export function useLiveJson<T extends { ok: boolean }>(url: string | null, intervalMs = 60_000, shareArrivalLane = false): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    let generation = 0
    let abort: AbortController | null = null

    let running = false
    let loadedAt = 0
    const load = async () => {
      if (running) return
      running = true
      loadedAt = Date.now()
      const request = ++generation
      const controller = new AbortController()
      abort = controller
      const run = shareArrivalLane ? (task: () => Promise<void>) => arrivalLane(task) : (task: () => Promise<void>) => task()
      try {
        await run(async () => {
          if (cancelled || request !== generation) return
          try {
            const response = await fetch(withBase(url), { cache: "no-store", signal: controller.signal })
            const body: unknown = await response.json()
            if (cancelled || request !== generation) return
            if (!hasOk(body)) {
              setError(`Unexpected response (${response.status})`)
              return
            }
            const incoming = body as T
            setData((current) => nextReading(current, incoming))
            setError(incoming.ok ? null : readingError(incoming, response.status))
          } catch (cause) {
            if (cancelled || request !== generation || controller.signal.aborted) return
            setError(cause instanceof Error ? cause.message : "Request failed")
          }
        })
      } finally {
        running = false
      }
    }

    // A tab in the background skips its refreshes, and catches up when it is seen again.
    const tick = () => {
      if (!document.hidden) void load()
    }
    const onVisible = () => {
      if (!document.hidden && Date.now() - loadedAt >= intervalMs) void load()
    }
    tick()
    const timer = window.setInterval(tick, intervalMs)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      abort?.abort()
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [intervalMs, shareArrivalLane, url])

  if (!url) return { data: null, error: null }
  return { data, error }
}

function readingError(body: { ok: boolean }, status: number): string {
  if ("error" in body && typeof body.error === "string" && body.error) return body.error
  return `Feed failed (${status})`
}

function hasOk(value: unknown): value is { ok: boolean } {
  if (typeof value !== "object" || value === null || !("ok" in value)) return false
  return typeof value.ok === "boolean"
}
