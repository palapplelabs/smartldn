import { NextResponse, type NextRequest } from "next/server"
import { isNewVisit, visitDay } from "@/lib/visit-day"
import { recordPageView } from "@/lib/visits"

const DAY_SECONDS = 60 * 60 * 36

export function proxy(request: NextRequest) {
  if (request.headers.get("sec-fetch-dest") !== "document") return NextResponse.next()
  const day = visitDay(new Date())
  const fresh = isNewVisit(request.cookies.get("smartldn-visit")?.value, day)
  recordPageView(fresh ? "new" : "return")
  const response = NextResponse.next()
  if (!fresh) return response
  response.cookies.set("smartldn-visit", day, {
    httpOnly: true,
    maxAge: DAY_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: true,
  })
  return response
}

export const config = {
  matcher: "/",
}
