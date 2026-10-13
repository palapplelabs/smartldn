import { MESSAGES } from "@/lib/i18n"
import { LINKS, SITE_URL } from "@/lib/site"

// The map itself renders in the browser, so this is the page's prerendered text:
// what search engines and link previews read, and what a screen reader hears
// first. It repeats what the map's own panels and credit line already show.
const SOURCES = [
  "Road corridor status and the Thames crossings, from TfL",
  "Tube, Elizabeth line, Overground, DLR, tram and river bus arrivals and positions, from TfL",
  "Live bus positions, from the DfT Bus Open Data Service",
  "Road works, incidents and traffic cameras, from TfL",
  "Santander Cycles docks, from TfL",
  "Weather warnings from the Met Office, and flood warnings from the Environment Agency",
  "Air quality, from the London Air Quality Network",
  "Planning applications, from the GLA Planning London Datahub",
  "Congestion Charge and ULEZ zones, from the London Datastore",
] as const

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "SmartLDN",
  url: SITE_URL,
  description:
    "A free, open-source live map of Greater London that brings TfL, DfT, Met Office, Environment Agency, LAQN and GLA open data onto one view.",
  applicationCategory: "TravelApplication",
  operatingSystem: "Any",
  inLanguage: "en-GB",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
  license: "https://opensource.org/licenses/MIT",
  author: { "@type": "Person", name: "Peter Choi", sameAs: [LINKS.author] },
  isBasedOn: {
    "@type": "SoftwareSourceCode",
    name: "HK Traffic Intelligence",
    codeRepository: LINKS.upstream,
    author: { "@type": "Person", name: "Keith Li", sameAs: [LINKS.upstreamAuthor] },
  },
  workExample: { "@type": "SoftwareSourceCode", name: "SmartLDN source code", codeRepository: LINKS.repo, license: "https://opensource.org/licenses/MIT" },
}

export function About() {
  return (
    <section aria-labelledby="about-title" className="sr-only">
      <h1 id="about-title">SmartLDN: London&apos;s live open data on one map</h1>
      <p>
        SmartLDN is a free, open-source live map of Greater London. It brings TfL, DfT, Met Office, Environment Agency,
        London Air Quality Network and GLA open data onto one view, with a ranked list of what needs attention now.
      </p>
      <h2>What it shows</h2>
      <ul>
        {SOURCES.map((source) => (
          <li key={source}>{source}</li>
        ))}
      </ul>
      <h2>Who made it</h2>
      <p>
        Built by Peter Choi (Anchor Point, <a href={LINKS.author}>LinkedIn</a>), as a London port of{" "}
        <a href={LINKS.upstream}>HK Traffic Intelligence</a> by Keith Li. The <a href={LINKS.repo}>source code</a> is on
        GitHub under the MIT licence.
      </p>
      <p>{MESSAGES.independence}</p>
      <script
        type="application/ld+json"
        // Static data built above; "<" is escaped so the JSON can never close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, "\\u003c") }}
      />
    </section>
  )
}
