import type { Basemap, WatchLayer, WatchLayers } from "./types.ts"

const KEY = "smartldn-preferences"

const LAYER_IDS: readonly WatchLayer[] = [
  "roads",
  "cameras",
  "works",
  "incidents",
  "charges",
  "rail",
  "light",
  "bus",
  "river",
  "cycles",
  "planning",
  "air",
]

const TABS = ["ranked", "roads", "transit", "weather", "systems", "notes"] as const

export type IntelTabPreference = (typeof TABS)[number]

export type Preferences = {
  layers: WatchLayers
  basemap: Basemap
  ground: Exclude<Basemap, "buildings">
  intelOpen: boolean
  intelTab: IntelTabPreference
  barOpen: boolean
}

// Planning and air quality are opt-in: they are context, not live movement.
export const PREFERENCE_DEFAULTS: Preferences = {
  layers: {
    roads: true,
    cameras: true,
    works: true,
    incidents: true,
    charges: true,
    rail: true,
    light: true,
    bus: true,
    river: true,
    cycles: true,
    planning: false,
    air: false,
  },
  basemap: "satellite",
  ground: "satellite",
  intelOpen: true,
  intelTab: "ranked",
  barOpen: true,
}

const listeners = new Set<() => void>()
let current = PREFERENCE_DEFAULTS
const serverSnapshot: Preferences = PREFERENCE_DEFAULTS
let loaded = false

export function readPreferences(raw: string | null, fallback: Preferences = PREFERENCE_DEFAULTS): Preferences {
  if (!raw) return fallback
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return fallback
  }
  if (typeof parsed !== "object" || parsed === null) return fallback
  const row = parsed as Record<string, unknown>
  const ground = row.ground === "street" || row.ground === "satellite" ? row.ground : fallback.ground
  return {
    layers: readLayers(row.layers, fallback.layers),
    basemap: isBasemap(row.basemap) ? row.basemap : fallback.basemap,
    ground,
    intelOpen: typeof row.intelOpen === "boolean" ? row.intelOpen : fallback.intelOpen,
    intelTab: isTab(row.intelTab) ? row.intelTab : fallback.intelTab,
    barOpen: typeof row.barOpen === "boolean" ? row.barOpen : fallback.barOpen,
  }
}

export function preferenceSnapshot(): Preferences {
  ensureLoaded()
  return current
}

export function preferenceServerSnapshot(): Preferences {
  return serverSnapshot
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function updatePreference(patch: Partial<Preferences> | ((current: Preferences) => Partial<Preferences>)): void {
  ensureLoaded()
  const nextPatch = typeof patch === "function" ? patch(current) : patch
  const next = readPreferences(JSON.stringify({ ...current, ...nextPatch }), current)
  if (JSON.stringify(next) === JSON.stringify(current)) return
  current = next
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(current))
    } catch {
      // A private browser can refuse the write. The choice still applies for this visit.
    }
  }
  for (const listener of listeners) listener()
}

export function storedPreferenceRaw(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function ensureLoaded(): void {
  if (loaded || typeof window === "undefined") return
  loaded = true
  const raw = storedPreferenceRaw()
  current = raw ? readPreferences(raw) : PREFERENCE_DEFAULTS
}

export function soloLayers(layers: WatchLayers, id: WatchLayer): WatchLayers {
  const next = { ...layers }
  for (const key of LAYER_IDS) next[key] = key === id
  return next
}

export function chooseWatchedLayer(only: boolean, layers: WatchLayers, id: WatchLayer): { only: boolean; layers: WatchLayers } {
  if (!only) return { only: false, layers: { ...layers, [id]: !layers[id] } }
  const showing = soleLayer(layers)
  if (showing && showing !== id) return { only: false, layers: layersBeside(layers, id) ?? layers }
  if (showing === id) return { only: false, layers: { ...layers, [id]: false } }
  return { only: true, layers: soloLayers(layers, id) }
}

export function layersBeside(layers: WatchLayers, id: WatchLayer): WatchLayers | null {
  const current = soleLayer(layers)
  if (!current || current === id) return null
  const next = { ...layers }
  for (const key of LAYER_IDS) next[key] = key === current || key === id
  return next
}

export function soleLayer(layers: WatchLayers): WatchLayer | null {
  let found: WatchLayer | null = null
  for (const id of LAYER_IDS) {
    if (!layers[id]) continue
    if (found) return null
    found = id
  }
  return found
}

function readLayers(value: unknown, fallback: WatchLayers): WatchLayers {
  const source = typeof value === "object" && value !== null ? value as Record<string, unknown> : {}
  const layers = { ...fallback }
  for (const id of LAYER_IDS) {
    if (typeof source[id] === "boolean") layers[id] = source[id]
  }
  return layers
}

function isBasemap(value: unknown): value is Basemap {
  return value === "satellite" || value === "street" || value === "buildings"
}

function isTab(value: unknown): value is IntelTabPreference {
  return typeof value === "string" && TABS.some((tab) => tab === value)
}
