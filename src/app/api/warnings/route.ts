import { fetchUpstream } from "@/lib/upstream"
import { EMPTY_CONDITIONS, parseConditions, parseWarnsum, type HkoLang } from "@/lib/warnings"
import type { WarningsResponse, WeatherConditions } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("lang")
  const lang: HkoLang = requested === "en" || requested === "sc" || requested === "tc" ? requested : "tc"
  const warnsum = `https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=${lang}`
  const conditionsUrl = `https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=${lang}`
  const [warningsResult, conditionsResult] = await Promise.allSettled([readJson(warnsum), readJson(conditionsUrl)])
  const warnings = warningsResult.status === "fulfilled" ? parseWarnsum(warningsResult.value, lang) : []
  const conditions = conditionsResult.status === "fulfilled" ? parseConditions(conditionsResult.value) : EMPTY_CONDITIONS
  const error = feedError(warningsResult, conditionsResult, conditions)
  const body: WarningsResponse = {
    ok: error == null,
    error,
    observedAt: new Date().toISOString(),
    warnings,
    conditions,
  }
  return Response.json(body, { status: error && warnings.length === 0 && conditions.temperatureC == null ? 502 : 200 })
}

function feedError(
  warningsResult: PromiseSettledResult<unknown>,
  conditionsResult: PromiseSettledResult<unknown>,
  conditions: WeatherConditions,
): string | undefined {
  if (warningsResult.status === "rejected" && conditionsResult.status === "rejected") {
    return warningsResult.reason instanceof Error ? warningsResult.reason.message : "Weather warnings failed"
  }
  if (warningsResult.status === "rejected") {
    return warningsResult.reason instanceof Error ? warningsResult.reason.message : "Weather warnings failed"
  }
  if (conditions.temperatureC == null && conditions.rainfallMm == null && conditionsResult.status === "rejected") {
    return conditionsResult.reason instanceof Error ? conditionsResult.reason.message : "Current weather failed"
  }
  return undefined
}

async function readJson(url: string): Promise<unknown> {
  const response = await fetchUpstream(url, 60_000, { timeoutMs: 20_000, headers: { Accept: "application/json" } })
  if (response.status !== 200) throw new Error(`HTTP ${response.status} from the Observatory`)
  return JSON.parse(new TextDecoder().decode(response.body)) as unknown
}
