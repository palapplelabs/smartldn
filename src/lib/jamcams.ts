// TfL JamCams: about 900 traffic cameras, each with a still and a ten-second clip
// refreshed every few minutes on TfL's public bucket.

const JAMCAM_PREFIX = "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/"

const COMPASS: Record<string, number> = {
  north: 0,
  "north east": 45,
  northeast: 45,
  east: 90,
  "south east": 135,
  southeast: 135,
  south: 180,
  "south west": 225,
  southwest: 225,
  west: 270,
  "north west": 315,
  northwest: 315,
}

export function isJamCamUrl(value: string): boolean {
  return value.startsWith(JAMCAM_PREFIX) && /^[\w./-]+$/.test(value.slice(JAMCAM_PREFIX.length))
}

export function viewRotation(view: string): number | null {
  const key = view.trim().toLowerCase().replace(/-/g, " ").replace(/bound$/, "")
  return COMPASS[key] ?? null
}

export function camerasFromPlaces(rows: { id: string; name: string; lng: number; lat: number; props: Record<string, string> }[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const row of rows) {
    if (row.props.available === "false") continue
    const image = row.props.imageUrl ?? ""
    if (!isJamCamUrl(image)) continue
    const video = row.props.videoUrl ?? ""
    const view = row.props.view ?? ""
    const rotation = viewRotation(view)
    features.push({
      type: "Feature",
      properties: {
        id: row.id,
        name: row.name,
        view,
        image,
        video: isJamCamUrl(video) ? video : "",
        ...(rotation == null ? {} : { rotation }),
      },
      geometry: { type: "Point", coordinates: [row.lng, row.lat] },
    })
  }
  return { type: "FeatureCollection", features }
}
