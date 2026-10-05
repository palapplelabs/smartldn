import { NextResponse } from "next/server"
import { recordPageView } from "@/lib/visits"

// Counts page opens only. No cookie and no identifier, so nothing is stored on
// the visitor's device and no consent banner is needed.
export function proxy(request: Request) {
  if (request.headers.get("sec-fetch-dest") === "document") recordPageView()
  return NextResponse.next()
}

export const config = {
  matcher: "/",
}
