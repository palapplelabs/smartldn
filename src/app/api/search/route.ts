import { cleanQuery, mergePlaces, photonPlaces, postcodeKind, postcodePlace, stationMatches } from "@/lib/place-search"
import { stationList } from "@/lib/rail-network"
import { errorText } from "@/lib/snapshot-route"
import { fetchUpstream } from "@/lib/upstream"
import { inLondon } from "@/lib/view-reach"
import type { SearchPlace, SearchResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const PHOTON = "https://photon.komoot.io/api/"
const POSTCODES = "https://api.postcodes.io"
// Greater London with a margin, as Photon's bbox wants it: west,south,east,north.
const LONDON_BBOX = "-0.56,51.26,0.35,51.71"
// Photon is a shared public service: it asks callers to say who they are.
const PHOTON_HEADERS = { "User-Agent": "SmartLDN (https://github.com/palapplelabs/smartldn)" }
const RESULT_LIMIT = 6
const PLACE_TTL_MS = 6 * 60 * 60_000
const POSTCODE_TTL_MS = 24 * 60 * 60_000

const stations = stationList()

export async function GET(request: Request) {
  const query = cleanQuery(new URL(request.url).searchParams.get("q"))
  if (!query) return Response.json({ ok: false, error: "Search missing", places: [] } satisfies SearchResponse, { status: 400 })
  const key = query.toLowerCase()
  const postcode = postcodeKind(query)
  const [fromPostcode, fromPhoton] = await Promise.allSettled([
    postcode ? postcodeLookup(query, postcode) : Promise.resolve([]),
    // A postcode or postcode district is answered by postcodes.io alone.
    postcode ? Promise.resolve([]) : photonLookup(query, key),
  ])
  const found = (result: PromiseSettledResult<SearchPlace[]>) => (result.status === "fulfilled" ? result.value : [])
  const places = mergePlaces([stationMatches(query, stations), found(fromPostcode), found(fromPhoton)], RESULT_LIMIT).filter((place) =>
    inLondon(place.lng, place.lat),
  )
  if (places.length === 0 && fromPhoton.status === "rejected" && fromPostcode.status !== "fulfilled") {
    return Response.json({ ok: false, error: errorText(fromPhoton.reason, "Search failed"), places } satisfies SearchResponse, { status: 502 })
  }
  return Response.json({ ok: true, places } satisfies SearchResponse, { headers: { "Cache-Control": "public, max-age=300" } })
}

async function postcodeLookup(query: string, kind: "full" | "outcode"): Promise<SearchPlace[]> {
  const code = encodeURIComponent(query.toUpperCase().replace(/\s+/g, ""))
  const url = kind === "full" ? `${POSTCODES}/postcodes/${code}` : `${POSTCODES}/outcodes/${code}`
  const upstream = await fetchUpstream(url, POSTCODE_TTL_MS, { timeoutMs: 6_000 })
  if (upstream.status !== 200) return []
  const place = postcodePlace(JSON.parse(new TextDecoder().decode(upstream.body)))
  return place ? [place] : []
}

async function photonLookup(query: string, key: string): Promise<SearchPlace[]> {
  const params = new URLSearchParams({ q: query, limit: "10", lang: "en", bbox: LONDON_BBOX })
  const upstream = await fetchUpstream(`${PHOTON}?${params}`, PLACE_TTL_MS, {
    headers: PHOTON_HEADERS,
    timeoutMs: 6_000,
    cacheKey: `${PHOTON}?q=${encodeURIComponent(key)}`,
  })
  if (upstream.status !== 200) throw new Error(`Place search ${upstream.status}`)
  return photonPlaces(JSON.parse(new TextDecoder().decode(upstream.body)))
}
