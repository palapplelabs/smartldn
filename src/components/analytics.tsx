"use client"

import Script from "next/script"
import { useEffect, useSyncExternalStore } from "react"
import { BASE_PATH } from "@/lib/base-path"
import { consentServerSnapshot, consentSnapshot, setConsent, subscribeConsent } from "@/lib/analytics-consent"
import { MESSAGES } from "@/lib/i18n"

// Google Analytics 4, loaded only after the visitor accepts. Until then no
// Google script runs and no analytics cookie is set. NEXT_PUBLIC_GA_ID is read
// at build time; without it this component renders nothing at all.
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? ""

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

function ConsentBanner() {
  const m = MESSAGES
  return (
    <div
      role="dialog"
      aria-label={m.analyticsTitle}
      className="pointer-events-auto fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md border border-cyan-200/40 bg-[#041018]/95 p-3 text-sm text-zinc-100 shadow-[0_0_24px_rgba(34,211,238,0.12)] backdrop-blur-md"
    >
      <p className="leading-5">{m.analyticsAsk}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            ;(window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = false
            setConsent("granted")
          }}
          className="border border-cyan-200/60 bg-cyan-300/15 px-3 py-1 font-[family-name:var(--font-hud)] text-xs tracking-[0.08em] text-white uppercase"
        >
          {m.analyticsAccept}
        </button>
        <button
          type="button"
          onClick={() => {
            clearAnalyticsCookies()
            setConsent("denied")
          }}
          className="border border-white/20 px-3 py-1 font-[family-name:var(--font-hud)] text-xs tracking-[0.08em] text-zinc-200 uppercase"
        >
          {m.analyticsDecline}
        </button>
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
