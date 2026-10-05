import { localeOf, type Locale } from "./i18n.ts"
import type { Basemap, WatchLayer, WatchLayers } from "./types.ts"

const KEY = "hk-traffic-preferences"

const LAYER_IDS: readonly WatchLayer[] = [
  "speed",
  "cameras",
  "works",
  "tolls",
  "incidents",
  "control",
  "mtr",
  "lrt",
  "kmb",
  "citybus",
  "gmb",
  "nlb",
  "ferry",
  "parking",
]

const TABS = ["ranked", "roads", "boundary", "weather", "systems", "notes"] as const

export type IntelTabPreference = (typeof TABS)[number]

export type Preferences = {
  locale: Locale
  layers: WatchLayers
  basemap: Basemap
  ground: Exclude<Basemap, "buildings">
  intelOpen: boolean
  intelTab: IntelTabPreference
  barOpen: boolean
  pinnedOrigin: string | null
}

export const PREFERENCE_DEFAULTS: Preferences = {
  locale: "zh-HK",
  layers: {
    speed: true,
    cameras: true,
    works: true,
    tolls: true,
    incidents: true,
    control: true,
    mtr: true,
    lrt: true,
    kmb: true,
    citybus: true,
    gmb: true,
    nlb: true,
    ferry: true,
    parking: true,
  },
  basemap: "satellite",
  ground: "satellite",
  intelOpen: true,
  intelTab: "ranked",
  barOpen: true,
  pinnedOrigin: null,
}

const listeners = new Set<() => void>()
let current = PREFERENCE_DEFAULTS
let serverSnapshot: Preferences = PREFERENCE_DEFAULTS
let loaded = false

export function noteServerLocale(locale: Locale) {
  if (serverSnapshot.locale === locale) return
  serverSnapshot = { ...PREFERENCE_DEFAULTS, locale }
}

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
    locale: localeOf(typeof row.locale === "string" ? row.locale : fallback.locale),
    layers: readLayers(row.layers, fallback.layers),
    basemap: isBasemap(row.basemap) ? row.basemap : fallback.basemap,
    ground,
    intelOpen: typeof row.intelOpen === "boolean" ? row.intelOpen : fallback.intelOpen,
    intelTab: isTab(row.intelTab) ? row.intelTab : fallback.intelTab,
    barOpen: typeof row.barOpen === "boolean" ? row.barOpen : fallback.barOpen,
    pinnedOrigin: row.pinnedOrigin === null ? null : typeof row.pinnedOrigin === "string" && row.pinnedOrigin ? row.pinnedOrigin : fallback.pinnedOrigin,
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
  current = raw ? readPreferences(raw) : { ...PREFERENCE_DEFAULTS, locale: serverSnapshot.locale }
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
