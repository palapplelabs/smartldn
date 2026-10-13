import { BASE_PATH } from "./base-path.ts"

// The public address, for canonical and link-preview URLs. A fork sets its own.
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://labs.palapple.com"
export const SITE_URL = `${SITE_ORIGIN}${BASE_PATH}`

export const LINKS = {
  repo: "https://github.com/palapplelabs/smartldn",
  author: "https://www.linkedin.com/in/peterchoicm",
  upstream: "https://github.com/keithligh/hk-traffic-intelligence",
  upstreamAuthor: "https://www.linkedin.com/in/keithlihk",
} as const
