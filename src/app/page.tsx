import { Suspense } from "react"
import { Dashboard } from "@/components/dashboard"

export default function Page() {
  return (
    <Suspense fallback={<div className="h-dvh bg-[#061018]" />}>
      <Dashboard />
    </Suspense>
  )
}
