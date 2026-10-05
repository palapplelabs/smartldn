import type { Metadata } from "next"
import { IBM_Plex_Mono, Newsreader, Outfit } from "next/font/google"
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

export const metadata: Metadata = {
  title: "SmartLDN · London live city map",
  description:
    "Live London on one map: TfL road status, Thames crossings, Tube, rail, DLR, tram, bus and river arrivals, road works, cameras, cycles, weather, air quality and planning.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${outfit.variable} ${newsreader.variable} ${hud.variable} dark h-full antialiased`}>
      <body className={`${outfit.className} min-h-full`}>{children}</body>
    </html>
  )
}
