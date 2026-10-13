import type { Metadata } from "next"
import { IBM_Plex_Mono, Newsreader, Outfit } from "next/font/google"
import { Analytics, VisitBeacon } from "@/components/analytics"
import { SITE_ORIGIN, SITE_URL } from "@/lib/site"
import "./globals.css"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
})

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
})

const hud = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-hud",
})

const TITLE = "SmartLDN · London live city map"
const DESCRIPTION =
  "Live London on one map: TfL road status, Thames crossings, Tube, rail, DLR, tram, bus and river arrivals, road works, cameras, cycles, weather, air quality and planning."

// The preview image comes from app/opengraph-image.jpg; Next adds its tags.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "SmartLDN",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${outfit.variable} ${newsreader.variable} ${hud.variable} dark h-full antialiased`}>
      <body className={`${outfit.className} min-h-full`}>
        {children}
        <VisitBeacon />
        <Analytics />
      </body>
    </html>
  )
}
