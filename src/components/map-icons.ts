import type { Map } from "maplibre-gl"
import { stopPlate, stopPlateKey, type StopPlate } from "@/lib/stop-plate"

// Canvas-drawn map icons: stop name plates, the incident diamond, the camera cone.

let plateFamily = ""

function stopPlateIconId(plate: StopPlate, stroke: string): string {
  return `stop-plate-${stroke.slice(1)}-${encodeURIComponent(stopPlateKey(plate))}`
}

export function placeStopPlate(map: Map, name: string, routes: string[], stroke: string, options?: { perLine?: number; keepOrder?: boolean }): string {
  const plate = stopPlate(name, routes, options)
  if (!plate.title && plate.lines.length === 0) return ""
  const icon = stopPlateIconId(plate, stroke)
  ensureStopPlate(map, icon, plate, stroke)
  return map.hasImage(icon) ? icon : ""
}

function ensureStopPlate(map: Map, id: string, plate: StopPlate, stroke: string) {
  if (map.hasImage(id)) return
  const image = stopPlateImage(plate, stroke)
  if (image) map.addImage(id, image, { pixelRatio: 2 })
}

function stopPlateImage(plate: StopPlate, stroke: string): ImageData | null {
  const scale = 2
  plateFamily ||= getComputedStyle(document.body).fontFamily || "sans-serif"
  const family = plateFamily
  const titleFont = `600 ${11 * scale}px ${family}`
  const routeFont = `600 ${10 * scale}px ${family}`
  const probe = document.createElement("canvas").getContext("2d")
  if (!probe) return null
  const rows = plate.title ? [plate.title, ...plate.lines] : plate.lines
  if (rows.length === 0) return null
  const widths = rows.map((row, index) => {
    probe.font = index === 0 && plate.title ? titleFont : routeFont
    return Math.ceil(probe.measureText(row).width)
  })
  const padX = 6 * scale
  const padY = 4 * scale
  const lineHeight = 13 * scale
  const width = Math.max(1, Math.max(...widths) + padX * 2)
  const height = Math.max(1, rows.length * lineHeight + padY * 2)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return null
  context.clearRect(0, 0, width, height)
  context.beginPath()
  context.roundRect(scale, scale, width - scale * 2, height - scale * 2, 6 * scale)
  context.fillStyle = "rgba(4, 16, 24, 0.92)"
  context.fill()
  context.lineWidth = scale
  context.strokeStyle = stroke
  context.stroke()
  context.textAlign = "left"
  context.textBaseline = "middle"
  rows.forEach((row, index) => {
    const titleRow = index === 0 && plate.title
    context.font = titleRow ? titleFont : routeFont
    context.fillStyle = titleRow ? "#fff8e8" : "#ffedd5"
    context.fillText(row, padX, padY + lineHeight * index + lineHeight / 2)
  })
  return context.getImageData(0, 0, width, height)
}

export function incidentMark(): ImageData | null {
  const size = 64
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return null
  context.clearRect(0, 0, size, size)
  context.translate(size / 2, size / 2)
  context.beginPath()
  context.moveTo(0, -22)
  context.lineTo(18, 0)
  context.lineTo(0, 22)
  context.lineTo(-18, 0)
  context.closePath()
  context.fillStyle = "#FF5D73"
  context.fill()
  context.lineWidth = 4
  context.strokeStyle = "#FFF7F8"
  context.stroke()
  context.beginPath()
  context.moveTo(0, -8)
  context.lineTo(0, 4)
  context.lineWidth = 3
  context.strokeStyle = "#041018"
  context.stroke()
  context.beginPath()
  context.arc(0, 10, 1.8, 0, Math.PI * 2)
  context.fillStyle = "#041018"
  context.fill()
  return context.getImageData(0, 0, size, size)
}

export function cameraCone(): ImageData | null {
  const size = 64
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return null
  context.clearRect(0, 0, size, size)
  context.translate(size / 2, size / 2)
  context.beginPath()
  context.moveTo(0, 2)
  context.lineTo(-18, -26)
  context.quadraticCurveTo(0, -18, 18, -26)
  context.closePath()
  context.fillStyle = "rgba(125, 211, 232, 0.72)"
  context.fill()
  context.lineWidth = 2
  context.strokeStyle = "rgba(236, 254, 255, 0.95)"
  context.stroke()
  context.beginPath()
  context.arc(0, 2, 5, 0, Math.PI * 2)
  context.fillStyle = "#F4FEFF"
  context.fill()
  context.lineWidth = 1.5
  context.strokeStyle = "#083044"
  context.stroke()
  return context.getImageData(0, 0, size, size)
}
