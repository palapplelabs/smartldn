"use client"

import Script from "next/script"
import { useEffect, useState, useSyncExternalStore } from "react"
import { BASE_PATH } from "@/lib/base-path"
import { consentServerSnapshot, consentSnapshot, setConsent, subscribeConsent } from "@/lib/analytics-consent"
import { MESSAGES } from "@/lib/i18n"

// Google Analytics 4, loaded only after the visitor accepts. Until then no
// Google script runs and no analytics cookie is set. NEXT_PUBLIC_GA_ID is read
// at build time; without it this component renders nothing at all.
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? ""

// Cloudflare Web Analytics counts visits without cookies or identifiers, so it
// needs no consent and counts the visitors who never answer the banner.
const CF_BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN ?? ""

export function VisitBeacon() {
  if (!CF_BEACON_TOKEN) return null
  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={JSON.stringify({ token: CF_BEACON_TOKEN })}
    />
  )
}

export function Analytics() {
  const consent = useSyncExternalStore(subscribeConsent, consentSnapshot, consentServerSnapshot)
  // Without consent, sweep away anything GA left from an earlier "yes".
  useEffect(() => {
    if (GA_ID && consent !== "granted") clearAnalyticsCookies()
  }, [consent])
  if (!GA_ID) return null
  if (consent === "unset") return <ConsentBanner />
  if (consent !== "granted") return null
  // Cookies stay on this host and this app's path, never the parent domain
  // (GA's default), so other sites on palapple.com never see them.
  const config = JSON.stringify({ cookie_domain: "none", cookie_path: BASE_PATH || "/" })
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config",${JSON.stringify(GA_ID)},${config});`}
      </Script>
    </>
  )
}

// Shown just after the map settles, centred and in a colour the map controls never
// use, so it is not mistaken for part of the dashboard. Accept and Decline are
// styled alike: the visitor is asked, not steered. The dim behind it lets clicks
// through, so the map stays usable while the question waits.
const BANNER_DELAY_MS = 1_200

function ConsentBanner() {
  const m = MESSAGES
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(true), BANNER_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])
  const choice =
    "flex-1 border border-amber-200/70 bg-amber-300/10 px-3 py-2 font-[family-name:var(--font-hud)] text-xs tracking-[0.1em] text-amber-50 uppercase transition-colors hover:bg-amber-300/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 transition-opacity duration-500 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
    >
      <div
        role="dialog"
        aria-labelledby="analytics-title"
        className={`pointer-events-auto w-full max-w-sm border border-amber-200/50 border-t-4 border-t-amber-300 bg-[#0b0d10]/95 p-4 text-sm text-zinc-100 shadow-[0_12px_48px_rgba(0,0,0,0.6)] backdrop-blur-md transition-transform duration-500 motion-reduce:transition-none ${shown ? "translate-y-0" : "translate-y-3"}`}
      >
        <h2 id="analytics-title" className="font-[family-name:var(--font-hud)] text-xs tracking-[0.14em] text-amber-200 uppercase">
          {m.analyticsTitle}
        </h2>
        <p className="mt-2 leading-5">{m.analyticsWhy}</p>
        <p className="mt-2 leading-5 text-zinc-300">{m.analyticsAsk}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              ;(window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = false
              setConsent("granted")
            }}
            className={choice}
          >
            {m.analyticsAccept}
          </button>
          <button
            type="button"
            onClick={() => {
              clearAnalyticsCookies()
              setConsent("denied")
            }}
            className={choice}
          >
            {m.analyticsDecline}
          </button>
        </div>
      </div>
    </div>
  )
}

// Lets a visitor change their answer later; it reloads so a withdrawn consent
// also stops the script that is already running.
export function AnalyticsChoice() {
  const consent = useSyncExternalStore(subscribeConsent, consentSnapshot, consentServerSnapshot)
  if (!GA_ID) return null
  const m = MESSAGES
  return (
    <span className="mt-1 block">
      {consent === "granted" ? m.analyticsOn : m.analyticsOff}{" "}
      <button
        type="button"
        onClick={() => {
          clearAnalyticsCookies()
          setConsent("unset")
          window.location.reload()
        }}
        className="text-cyan-100 underline decoration-cyan-200/60 underline-offset-2"
      >
        {m.analyticsChange}
      </button>
    </span>
  )
}

// Withdrawing consent also removes what GA already stored. GA's own opt-out flag
// goes first, so a script still on the page cannot write the cookies back.
function clearAnalyticsCookies() {
  ;(window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = true
  const path = BASE_PATH || "/"
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim() ?? ""
    if (!name.startsWith("_ga")) continue
    for (const cookiePath of [path, "/"]) document.cookie = `${name}=; Max-Age=0; path=${cookiePath}`
  }
}
