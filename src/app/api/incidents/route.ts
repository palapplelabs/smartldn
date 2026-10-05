import { fetchText } from "@/lib/fetch-text"
import { loadRoadPoints, parseIncidents, placeIncident } from "@/lib/incidents"
import type { IncidentsResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

const NEWS_URL = "https://www.td.gov.hk/en/special_news/trafficnews.xml"

export async function GET() {
  try {
    const [xml, roads] = await Promise.all([fetchText(NEWS_URL, 20_000), loadRoadPoints()])
    const messages = parseIncidents(xml)
    const features: GeoJSON.Feature[] = []
    for (const message of messages) {
      if (message.closed) continue
      const coordinates = placeIncident(message, roads)
      if (!coordinates) continue
      features.push({
        type: "Feature",
        properties: {
          name: message.detail || message.heading || "Incident",
          nameTc: message.detailTc || message.headingTc,
          location: message.locationTc || message.locationEn,
          locationEn: message.locationEn,
          landmark: message.landmarkTc || message.landmarkEn,
          landmarkEn: message.landmarkEn,
          direction: message.direction,
          directionTc: message.directionTc,
          content: message.content,
          contentTc: message.contentTc,
          announced: message.announced,
        },
        geometry: { type: "Point", coordinates },
      })
    }
    const body: IncidentsResponse = {
      ok: true,
      observedAt: messages.find((message) => message.announced)?.announced ?? null,
      incidents: { type: "FeatureCollection", features },
    }
    return Response.json(body)
  } catch (error) {
    const body: IncidentsResponse = {
      ok: false,
      error: error instanceof Error ? error.message : "Special traffic news failed",
      observedAt: null,
      incidents: { type: "FeatureCollection", features: [] },
    }
    return Response.json(body, { status: 502 })
  }
}
