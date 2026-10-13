import { Suspense } from "react"
import { About } from "@/components/about"
import { Dashboard } from "@/components/dashboard"

export default function Page() {
  return (
    <>
      <About />
      <Suspense fallback={<div className="h-dvh bg-[#061018]" />}>
        <Dashboard />
      </Suspense>
    </>
  )
}
