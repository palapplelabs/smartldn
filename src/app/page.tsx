import { Suspense } from "react"
import { cookies } from "next/headers"
import { Dashboard } from "@/components/dashboard"
import { LocaleProvider } from "@/components/locale"
import { localeOf } from "@/lib/i18n"

export default async function Page() {
  const store = await cookies()
  const locale = localeOf(store.get("locale")?.value)
  return (
    <Suspense fallback={<div className="h-dvh bg-[#061018]" />}>
      <LocaleProvider initial={locale}>
        <Dashboard />
      </LocaleProvider>
    </Suspense>
  )
}
