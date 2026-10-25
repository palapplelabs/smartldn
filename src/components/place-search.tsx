"use client"

import { useEffect, useId, useRef, useState } from "react"
import { withBase } from "@/lib/base-path"
import { MESSAGES } from "@/lib/i18n"
import type { SearchPlace, SearchResponse } from "@/lib/types"

const DEBOUNCE_MS = 250
const MIN_LENGTH = 2

type Results = { query: string; places: SearchPlace[]; failed: boolean }

// A search box over the map: type a station, place, street or postcode, pick a
// result, and the map flies there and drops a pin.
export function PlaceSearch({ onPick, onClear, picked }: { onPick: (place: SearchPlace) => void; onClear: () => void; picked: boolean }) {
  const m = MESSAGES
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState("")
  const [results, setResults] = useState<Results | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const query = text.trim()
  useEffect(() => {
    if (query.length < MIN_LENGTH) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(withBase(`/api/search?q=${encodeURIComponent(query)}`), { signal: controller.signal })
        const body = (await response.json()) as SearchResponse
        setResults({ query, places: body.places ?? [], failed: !body.ok })
      } catch {
        if (!controller.signal.aborted) setResults({ query, places: [], failed: true })
      }
    }, DEBOUNCE_MS)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  const current = results && results.query === query && query.length >= MIN_LENGTH ? results : null
  const places = current?.places ?? []
  const showing = open && current != null

  const pick = (place: SearchPlace) => {
    setText(place.name)
    setOpen(false)
    setActive(-1)
    inputRef.current?.blur()
    onPick(place)
  }
  const clear = () => {
    setText("")
    setResults(null)
    setOpen(false)
    setActive(-1)
    onClear()
    inputRef.current?.focus()
  }

  return (
    <div className="pointer-events-auto absolute top-[var(--search-top,4.25rem)] right-2 left-14 z-[7] sm:right-auto sm:w-80 lg:left-16">
      <div className="flex items-center border border-cyan-200/40 bg-[#041018]/92 shadow-[0_0_24px_rgba(34,211,238,0.1)] backdrop-blur-md focus-within:border-cyan-200/80">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-2 size-4 shrink-0 text-cyan-200/80">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={m.searchLabel}
          aria-expanded={showing}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showing && active >= 0 ? `${listId}-${active}` : undefined}
          placeholder={m.searchPlaceholder}
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && places.length > 0) {
              event.preventDefault()
              setOpen(true)
              setActive((index) => (index + 1) % places.length)
            } else if (event.key === "ArrowUp" && places.length > 0) {
              event.preventDefault()
              setActive((index) => (index <= 0 ? places.length - 1 : index - 1))
            } else if (event.key === "Enter") {
              const place = places[active] ?? places[0]
              if (place) {
                event.preventDefault()
                pick(place)
              }
            } else if (event.key === "Escape") {
              if (open) setOpen(false)
              else if (text || picked) clear()
            }
          }}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white placeholder:text-cyan-100/50 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {text || picked ? (
          <button
            type="button"
            aria-label={m.searchClear}
            onClick={clear}
            className="mr-1 px-2 py-1 text-cyan-100/80 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-200"
          >
            ×
          </button>
        ) : null}
      </div>
      {showing ? (
        <ul id={listId} role="listbox" aria-label={m.searchLabel} className="mt-1 max-h-[min(22rem,55dvh)] overflow-y-auto border border-cyan-200/30 bg-[#041018]/95 backdrop-blur-md">
          {places.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-sm text-cyan-100/70">
              {current?.failed ? m.searchFailed : m.searchNone}
            </li>
          ) : (
            places.map((place, index) => (
              <li
                key={place.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(place)}
                onMouseEnter={() => setActive(index)}
                className={`cursor-pointer border-b border-white/5 px-3 py-2 last:border-b-0 ${index === active ? "bg-cyan-300/15" : ""}`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-white">{place.name}</span>
                  <span className="shrink-0 font-[family-name:var(--font-hud)] text-[0.6rem] tracking-[0.12em] text-cyan-200/70 uppercase">{m.searchKind[place.kind]}</span>
                </span>
                {place.detail ? <span className="block truncate text-xs text-cyan-100/60">{place.detail}</span> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
