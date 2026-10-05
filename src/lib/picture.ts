import { standardHan } from "@/lib/camera-place"

export const CAMERA_LAYER_MS = 6 * 60 * 60 * 1000
export const TOLL_LAYER_MS = 6 * 60 * 60 * 1000
export const WORKS_LAYER_MS = 5 * 60 * 1000
export const PICTURE_POLL_MS = WORKS_LAYER_MS

const HARBOUR_DISTRICTS: ReadonlySet<string> = new Set([
  "Central & Western",
  "Wan Chai",
  "Eastern",
  "Yau Tsim Mong",
  "Kowloon City",
  "Kwun Tong",
])

const TUNNEL_NAMES: Record<string, string> = {
  WHC: "Western Harbour Crossing",
  CHT: "Cross Harbour Tunnel",
  EHC: "Eastern Harbour Crossing",
  TLT: "Tai Lam Tunnel",
}

const CAMERA_URL = /^https:\/\/tdcctv\.data\.one\.gov\.hk\/[A-Za-z0-9._-]+\.jpe?g$/i

export function isCameraSnapshotUrl(value: string): boolean {
  return CAMERA_URL.test(value)
}

export function camerasFromWfs(wfs: unknown): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  const seen = new Set<string>()
  for (const feature of featuresOf(wfs)) {
    const id = text(feature.properties?.KEY)
    const coordinates = pointOf(feature.geometry)
    if (!id || !coordinates || seen.has(id)) continue
    seen.add(id)
    const district = text(feature.properties?.DISTRICT)
    const url = text(feature.properties?.URL)
    features.push({
      type: "Feature",
      properties: {
        id,
        name: text(feature.properties?.DESCRIPTION) || id,
        district,
        region: text(feature.properties?.TD_REGION),
        url: isCameraSnapshotUrl(url) ? url : "",
        rotation: rotationOf(feature.properties?.ROTATION),
        harbour: HARBOUR_DISTRICTS.has(district) ? 1 : 0,
      },
      geometry: { type: "Point", coordinates },
    })
  }
  return { type: "FeatureCollection", features }
}

export function worksFromWfs(wfs: unknown): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const feature of featuresOf(wfs)) {
    const coordinates = pointOf(feature.geometry)
    const id = text(feature.properties?.ROADWORKS_ID)
    if (!id || !coordinates) continue
    features.push({
      type: "Feature",
      properties: {
        id,
        road: text(feature.properties?.ROAD_NAME),
        place: text(feature.properties?.LOC_DESC),
        status: text(feature.properties?.WORKS_STATUS) || "Road work",
        kind: text(feature.properties?.WORKS_TYPE),
        lane: text(feature.properties?.LANE),
        bound: text(feature.properties?.BOUND),
        district: text(feature.properties?.DISTRICT),
        start: text(feature.properties?.START_TIME),
        end: text(feature.properties?.END_TIME),
      },
      geometry: { type: "Point", coordinates },
    })
  }
  return { type: "FeatureCollection", features }
}

export function tollsFromWfs(wfs: unknown): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  const seen = new Set<string>()
  for (const feature of featuresOf(wfs)) {
    const coordinates = pointOf(feature.geometry)
    const code = text(feature.properties?.TunnelCode)
    const featureId = text(feature.properties?.FeatureID) || numberText(feature.properties?.FeatureID)
    if (!code || !coordinates || !featureId || seen.has(featureId)) continue
    seen.add(featureId)
    const scale = text(feature.properties?.Scale)
    features.push({
      type: "Feature",
      properties: {
        id: featureId,
        code,
        name: TUNNEL_NAMES[code] ?? code,
        band: scale === "300+" ? "overview" : "portal",
      },
      geometry: { type: "Point", coordinates },
    })
  }
  return { type: "FeatureCollection", features }
}

export function withTraditionalText(
  english: GeoJSON.FeatureCollection,
  traditional: GeoJSON.FeatureCollection,
  fields: readonly string[],
): GeoJSON.FeatureCollection {
  const byId = new Map<string, GeoJSON.GeoJsonProperties>()
  for (const feature of traditional.features) {
    const id = propertyText(feature.properties, "id")
    if (id) byId.set(id, feature.properties)
  }
  return {
    type: "FeatureCollection",
    features: english.features.map((feature) => {
      const id = propertyText(feature.properties, "id")
      const translated = id ? byId.get(id) : null
      const properties: GeoJSON.GeoJsonProperties = { ...feature.properties }
      for (const field of fields) {
        const value = translated ? propertyText(translated, field) : ""
        if (properties) properties[`${field}Tc`] = value ? standardHan(value) : ""
      }
      return { ...feature, properties }
    }),
  }
}

function propertyText(properties: GeoJSON.GeoJsonProperties, key: string): string {
  const value = properties?.[key]
  return typeof value === "string" ? value.trim() : ""
}

function rotationOf(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return value
}

function featuresOf(wfs: unknown): WfsFeature[] {
  if (!isRecord(wfs) || !Array.isArray(wfs.features)) return []
  return wfs.features.flatMap((feature) => {
    if (!isRecord(feature)) return []
    return [
      {
        properties: isRecord(feature.properties) ? feature.properties : null,
        geometry: isRecord(feature.geometry) ? feature.geometry : null,
      },
    ]
  })
}

function pointOf(geometry: WfsFeature["geometry"]): [number, number] | null {
  if (!geometry || geometry.type !== "Point" || !Array.isArray(geometry.coordinates)) return null
  const [lng, lat] = geometry.coordinates
  if (typeof lng !== "number" || typeof lat !== "number") return null
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return [lng, lat]
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim()
  return ""
}

function numberText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

type WfsFeature = {
  properties: Record<string, unknown> | null
  geometry: Record<string, unknown> | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

const PORTAL_NAME = /tunnel|portal|harbour crossing/i
const PORTAL_METRES = 400

export function withPortalCameras(
  cameras: GeoJSON.FeatureCollection,
  tolls: GeoJSON.FeatureCollection,
): GeoJSON.FeatureCollection {
  const portals = tolls.features.flatMap((feature) => {
    const coordinates = pointCoordinates(feature)
    return coordinates ? [coordinates] : []
  })
  return {
    type: "FeatureCollection",
    features: cameras.features.map((feature) => {
      const name = feature.properties && typeof feature.properties.name === "string" ? feature.properties.name : ""
      const coordinates = pointCoordinates(feature)
      const atPortal = coordinates != null && portals.some((point) => metres(coordinates, point) <= PORTAL_METRES)
      return {
        ...feature,
        properties: {
          ...feature.properties,
          portal: PORTAL_NAME.test(name) || atPortal ? 1 : 0,
        },
      }
    }),
  }
}

function pointCoordinates(feature: GeoJSON.Feature): [number, number] | null {
  if (feature.geometry?.type !== "Point") return null
  const [lng, lat] = feature.geometry.coordinates
  if (typeof lng !== "number" || typeof lat !== "number") return null
  return [lng, lat]
}

function metres(a: [number, number], b: [number, number]): number {
  const dx = (a[0] - b[0]) * 111_320 * Math.cos(((a[1] + b[1]) * Math.PI) / 360)
  const dy = (a[1] - b[1]) * 110_540
  return Math.hypot(dx, dy)
}
