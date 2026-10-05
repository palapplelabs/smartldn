export type ChangelogKind = "added" | "fixed" | "improved"

export type ChangelogEntry = {
  id: string
  date: string
  kind: ChangelogKind
  text: string
}

// Written for readers of the map, newest first. The Hong Kong history lives in
// the upstream project, HK Traffic Intelligence.
export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    id: "2026-10-05-live-buses",
    date: "2026-10-05",
    kind: "added",
    text: "The temperature now comes from the Met Office's own hourly figure for central London. Met Office warnings now come with their areas: only warnings that reach Greater London are listed, and their areas are drawn on the map. Buses now move on the map from their live positions, with the route and destination on each bus at street level. Name plates for stops, stations and trains also show on the Streets and Buildings maps.",
  },
  {
    id: "2026-10-05-london",
    date: "2026-10-05",
    kind: "added",
    text: "SmartLDN opens on Greater London: TfL road corridors, JamCams, road works and incidents, the Thames crossings, Tube, Elizabeth line, Overground, DLR, trams, buses, river buses, Santander Cycles, Met Office and flood warnings, air quality, planning applications, and the Congestion Charge and ULEZ zones.",
  },
]
