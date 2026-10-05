import { fetchUpstream } from "@/lib/upstream"
import { kmbReachMetres } from "@/lib/kmb-reach"
import { parseParkingParks, parseParkingSpaces, parksNear, soloParkingRadiusMetres, type ParkingPark, type ParkingSpace } from "@/lib/parking-parks"

export type ParkingPlacesResponse = { ok: true; parks: ParkingPark[] } | { ok: false; error?: string; parks: ParkingPark[] }

const INFO_URL = "https://resource.data.one.gov.hk/td/carpark/basic_info_all.json"
const VACANCY_URL = "https://resource.data.one.gov.hk/td/carpark/vacancy_all.json"
const INFO_MS = 12 * 60 * 60 * 1000
const VACANCY_MS = 60_000
const WIDE_CAP = 600

export async function loadParkingPlaces(
  lng: number,
  lat: number,
  zoom = Number.NaN,
  wide = false,
): Promise<{ ok: true; parks: ParkingPark[] } | { ok: false }> {
  const parks = await catalogue()
  if (!parks) return { ok: false }
  return {
    ok: true,
    parks: wide
      ? parksNear(parks, lng, lat, soloParkingRadiusMetres(zoom, lat), WIDE_CAP)
      : parksNear(parks, lng, lat, kmbReachMetres(zoom, lat)),
  }
}

export async function loadParkingVacancy(id: string): Promise<{ ok: true; spaces: ParkingSpace[] } | { ok: false }> {
  const body = await readJson(VACANCY_URL, VACANCY_MS)
  if (!body) return { ok: false }
  return { ok: true, spaces: parseParkingSpaces(body, id) }
}

async function catalogue(): Promise<ParkingPark[] | null> {
  const body = await readJson(INFO_URL, INFO_MS)
  if (!body) return null
  return parseParkingParks(body)
}

async function readJson(url: string, ttlMs: number): Promise<unknown | null> {
  try {
    const response = await fetchUpstream(url, ttlMs, { timeoutMs: 8_000 })
    if (response.status !== 200) return null
    return JSON.parse(new TextDecoder().decode(response.body)) as unknown
  } catch {
    return null
  }
}
