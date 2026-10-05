import { Popup, type LngLat, type Map, type MapGeoJSONFeature, type MapMouseEvent } from "maplibre-gl"

// Popup cards stay inside the open part of the map: below the header, above the
// layer dock, and beside the intel panel. Moved unchanged from the original map.

const creditShow = new WeakMap<HTMLElement, () => void>()
const creditDragBound = new WeakSet<Map>()

export function holdDataCreditOpen(map: Map) {
  const root = map.getContainer().querySelector<HTMLElement>(".maplibregl-ctrl-attrib")
  const button = root?.querySelector<HTMLElement>("summary")
  if (!root || !button) return
  if (!creditShow.has(root)) {
    let closedByUser = false
    const show = () => {
      if (closedByUser) return
      root.classList.add("maplibregl-compact", "maplibregl-compact-show")
      root.setAttribute("open", "")
    }
    creditShow.set(root, show)
    button.addEventListener("click", () => {
      closedByUser = !root.classList.contains("maplibregl-compact-show")
    })
  }
  creditShow.get(root)?.()
  if (creditDragBound.has(map)) return
  creditDragBound.add(map)
  map.on("drag", () => {
    const live = map.getContainer().querySelector<HTMLElement>(".maplibregl-ctrl-attrib")
    if (live) creditShow.get(live)?.()
  })
}

export function popupOpener(map: Map) {
  let active: Popup | null = null
  return {
    show(lngLat: LngLat, content: HTMLElement) {
      active?.remove()
      active = new Popup({ className: "city-popup", closeButton: true, maxWidth: "360px", offset: 16 })
        .setLngLat(lngLat)
        .setDOMContent(content)
        .addTo(map)
      keepCardInView(map, active)
    },
    close() {
      active?.remove()
      active = null
    },
  }
}

const POPUP_ANCHORS = ["center", "top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"] as const
type PopupAnchor = (typeof POPUP_ANCHORS)[number]

function keepCardInView(map: Map, popup: Popup) {
  const element = popup.getElement()
  if (!element) return
  let queued = false
  let anchorLocked = false
  const fit = () => {
    if (queued || !popup.isOpen()) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      if (!popup.isOpen()) return
      anchorLocked = placeCard(map, popup, element, anchorLocked)
    })
  }
  fit()
  const observer = new ResizeObserver(fit)
  observer.observe(element)
  const image = element.querySelector("img")
  image?.addEventListener("load", fit)
  const release = () => {
    if (!popup.isOpen()) return
    if (!anchorOnMap(map, popup)) popup.remove()
  }
  map.on("move", release)
  map.on("moveend", fit)
  map.on("idle", fit)
  popup.once("close", () => {
    observer.disconnect()
    image?.removeEventListener("load", fit)
    map.off("move", release)
    map.off("moveend", fit)
    map.off("idle", fit)
  })
}

function anchorOnMap(map: Map, popup: Popup): boolean {
  const point = map.project(popup.getLngLat())
  const canvas = map.getCanvas()
  return point.x >= 0 && point.y >= 0 && point.x <= canvas.clientWidth && point.y <= canvas.clientHeight
}

function placeCard(map: Map, popup: Popup, element: HTMLElement, anchorLocked: boolean) {
  const limits = cardLimits(map)
  const mapBox = map.getContainer().getBoundingClientRect()
  popup.options.padding = {
    top: Math.max(0, limits.top - mapBox.top),
    right: Math.max(0, mapBox.right - limits.right),
    bottom: Math.max(0, mapBox.bottom - limits.bottom),
    left: Math.max(0, limits.left - mapBox.left),
  }
  fitCameraCard(element, limits)
  if (!anchorLocked) {
    popup.options.anchor = undefined
    popup.setOffset(popup.options.offset ?? 16)
    const anchor = popupAnchor(element)
    if (anchor) {
      popup.options.anchor = anchor
      anchorLocked = true
      popup.setOffset([0, 0])
    }
  }
  if (!anchorLocked) return false
  // The snapshot loads after the tip is placed, and the tip shift is a percentage
  // of the card. Slide the whole card until it sits in the open gap.
  let [ox, oy] = offsetPair(popup.options.offset)
  for (let pass = 0; pass < 3; pass += 1) {
    const box = element.getBoundingClientRect()
    const dx = Math.round(-overflowShift(box.left, box.right, limits.left, limits.right))
    const dy = Math.round(-overflowShift(box.top, box.bottom, limits.top, limits.bottom))
    if (dx === 0 && dy === 0) break
    ox += dx
    oy += dy
    popup.setOffset([ox, oy])
  }
  return true
}

function offsetPair(offset: Popup["options"]["offset"]): [number, number] {
  if (Array.isArray(offset)) return [Number(offset[0]) || 0, Number(offset[1]) || 0]
  return [0, 0]
}

function popupAnchor(element: HTMLElement): PopupAnchor | null {
  for (const name of POPUP_ANCHORS) {
    if (element.classList.contains(`maplibregl-popup-anchor-${name}`)) return name
  }
  return null
}

function fitCameraCard(element: HTMLElement, limits: CardLimits) {
  const availableW = limits.right - limits.left
  const availableH = limits.bottom - limits.top
  const card = element.querySelector(".city-card")
  if (card instanceof HTMLElement && availableW > 40) {
    const width = Math.min(300, Math.max(140, Math.floor(availableW - 28)))
    const next = `${width}px`
    if (card.style.maxWidth !== next) card.style.maxWidth = next
  }
  const image = element.querySelector(".city-card-figure img")
  if (!(image instanceof HTMLImageElement) || availableH < 40) return
  const imageBox = image.getBoundingClientRect()
  const rest = element.getBoundingClientRect().height - imageBox.height
  const cssCap = Math.min(220, window.innerHeight * 0.34)
  let cap = Math.min(cssCap, Math.max(0, Math.floor(availableH - rest)))
  const current = Number.parseFloat(image.style.maxHeight)
  if (!Number.isFinite(current) || Math.abs(current - cap) > 2) {
    image.style.maxHeight = `${Math.floor(cap)}px`
    const overflow = element.getBoundingClientRect().height - availableH
    if (overflow > 2) {
      cap = Math.max(0, Math.floor(image.getBoundingClientRect().height - overflow))
      image.style.maxHeight = `${cap}px`
    }
  }
}

function overflowShift(start: number, end: number, min: number, max: number): number {
  if (max <= min) return start - min
  if (end - start > max - min) return start - min
  if (start < min) return start - min
  if (end > max) return end - max
  return 0
}

type CardLimits = { top: number; right: number; bottom: number; left: number }

function cardLimits(map: Map): CardLimits {
  const mapBox = map.getContainer().getBoundingClientRect()
  let top = mapBox.top + 10
  let bottom = mapBox.bottom - 10
  let left = mapBox.left + 10
  let right = mapBox.right - 10
  for (const node of document.querySelectorAll<HTMLElement>("[data-map-chrome]")) {
    const box = node.getBoundingClientRect()
    if (box.width < 2 || box.height < 2) continue
    const kind = node.dataset.mapChrome
    if (kind === "top") top = Math.max(top, box.bottom + 10)
    if (kind === "bottom") bottom = Math.min(bottom, box.top - 10)
    if (kind === "panel") {
      const spansWidth = box.width > mapBox.width * 0.72
      const onRight = box.left > mapBox.left + mapBox.width * 0.35
      if (!spansWidth && onRight) right = Math.min(right, box.left - 10)
      else if (box.height < 88) bottom = Math.min(bottom, box.top - 10)
      // An open list fills the phone. The card draws above it so the snapshot stays readable.
    }
  }
  const root = map.getContainer()
  const zoom = root.querySelector(".maplibregl-ctrl-top-left")
  if (zoom instanceof HTMLElement) {
    const box = zoom.getBoundingClientRect()
    if (box.width > 2 && box.height > 2) left = Math.max(left, box.right + 10)
  }
  const credit = root.querySelector(".maplibregl-ctrl-bottom-right")
  if (credit instanceof HTMLElement) {
    const box = credit.getBoundingClientRect()
    if (box.width > 2 && box.height > 2) bottom = Math.min(bottom, box.top - 10)
  }
  return { top, right, bottom, left }
}

export function openFeature(
  showPopup: (lngLat: LngLat, content: HTMLElement) => void,
  event: MapMouseEvent & { features?: MapGeoJSONFeature[] },
  render: (properties: GeoJSON.GeoJsonProperties) => HTMLElement,
) {
  const feature = event.features?.[0]
  if (!feature) return
  showPopup(event.lngLat, render(feature.properties ?? null))
}
