import { deflateSync, inflateSync } from "node:zlib"

// Hong Kong land in these tiles is the SRTM radar surface measured in February 2000.
// The posting is about 30 m, but street-level tiles are only a few metres wide, so a
// 10–20 m radar jump becomes a cliff on flat ground in every district. Smooth across
// about 140 m. Tai Mo Shan is the highest mountain in Hong Kong, at 957 m, so no
// cell is allowed above that summit.
const MIN_HEIGHT_M = -30
const MAX_HEIGHT_M = 957
const MAX_STEP_M = 70
const SMOOTH_METRES = 140
const METRES_PER_PIXEL_AT_EQUATOR = 156543.03392
const HONG_KONG_LATITUDE = 22.35

export function repairTerrariumPng(bytes: Buffer, zoom: number): Buffer {
  const png = decodePng(bytes)
  const { width, height, data } = png
  const count = width * height
  const meters = new Float64Array(count)
  for (let index = 0; index < count; index += 1) {
    const offset = index * 4
    const red = data[offset] ?? 0
    const green = data[offset + 1] ?? 0
    const blue = data[offset + 2] ?? 0
    meters[index] = red * 256 + green + blue / 256 - 32768
  }

  const bad = markBadPixels(meters, width, height)
  fillBadPixels(meters, bad, width, height)
  const smoothed = boxBlur(meters, width, height, smoothRadius(zoom))
  meters.set(smoothed)
  writeTerrarium(data, meters)
  return encodePng(png)
}

function smoothRadius(zoom: number): number {
  const metresPerPixel =
    (METRES_PER_PIXEL_AT_EQUATOR * Math.cos((HONG_KONG_LATITUDE * Math.PI) / 180)) / 2 ** zoom
  if (!Number.isFinite(metresPerPixel) || metresPerPixel <= 0) return 1
  return Math.max(1, Math.min(28, Math.round(SMOOTH_METRES / metresPerPixel)))
}

function boxBlur(source: Float64Array, width: number, height: number, radius: number): Float64Array {
  const integral = new Float64Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y += 1) {
    let run = 0
    for (let x = 0; x < width; x += 1) {
      run += source[y * width + x] ?? 0
      const integralIndex = (y + 1) * (width + 1) + (x + 1)
      integral[integralIndex] = (integral[y * (width + 1) + (x + 1)] ?? 0) + run
    }
  }
  const smoothed = new Float64Array(source.length)
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius)
    const y1 = Math.min(height - 1, y + radius)
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(width - 1, x + radius)
      const sum =
        (integral[(y1 + 1) * (width + 1) + (x1 + 1)] ?? 0) -
        (integral[y0 * (width + 1) + (x1 + 1)] ?? 0) -
        (integral[(y1 + 1) * (width + 1) + x0] ?? 0) +
        (integral[y0 * (width + 1) + x0] ?? 0)
      smoothed[y * width + x] = sum / ((y1 - y0 + 1) * (x1 - x0 + 1))
    }
  }
  return smoothed
}

function markBadPixels(meters: Float64Array, width: number, height: number): Uint8Array {
  const count = width * height
  const bad = new Uint8Array(count)
  for (let index = 0; index < count; index += 1) {
    const value = meters[index] ?? 0
    if (value < MIN_HEIGHT_M || value > MAX_HEIGHT_M) bad[index] = 1
  }
  let changed = true
  while (changed) {
    changed = false
    const next = bad.slice()
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x
        if (bad[index]) continue
        const samples: number[] = []
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const neighbor = ny * width + nx
            if (bad[neighbor]) continue
            samples.push(meters[neighbor] ?? 0)
          }
        }
        if (samples.length < 4) continue
        const value = meters[index] ?? 0
        if (Math.abs(value - median(samples)) > MAX_STEP_M) {
          next[index] = 1
          changed = true
        }
      }
    }
    bad.set(next)
  }
  return bad
}

function fillBadPixels(meters: Float64Array, bad: Uint8Array, width: number, height: number) {
  for (let pass = 0; pass < 8; pass += 1) {
    const next = Float64Array.from(meters)
    const cleared: number[] = []
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x
        if (!bad[index]) continue
        const samples: number[] = []
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const neighbor = ny * width + nx
            if (bad[neighbor]) continue
            samples.push(meters[neighbor] ?? 0)
          }
        }
        if (samples.length === 0) continue
        next[index] = median(samples)
        cleared.push(index)
      }
    }
    if (cleared.length === 0) break
    meters.set(next)
    for (const index of cleared) bad[index] = 0
  }
  for (let index = 0; index < meters.length; index += 1) {
    if (!bad[index]) continue
    meters[index] = 0
  }
}

function writeTerrarium(data: Uint8Array, meters: Float64Array) {
  for (let index = 0; index < meters.length; index += 1) {
    const shifted = (meters[index] ?? 0) + 32768
    const red = Math.floor(shifted / 256)
    const rest = shifted - red * 256
    const green = Math.floor(rest)
    let blue = Math.round((rest - green) * 256)
    if (blue === 256) blue = 255
    const offset = index * 4
    data[offset] = clampByte(red)
    data[offset + 1] = clampByte(green)
    data[offset + 2] = clampByte(blue)
    data[offset + 3] = 255
  }
}

type Raster = { width: number; height: number; data: Uint8Array }

function decodePng(bytes: Buffer): Raster {
  if (bytes.length < 8 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Terrain tile is not a PNG")
  }
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat: Buffer[] = []
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.toString("ascii", offset + 4, offset + 8)
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length
    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8] ?? 0
      colorType = data[9] ?? 0
      interlace = data[12] ?? 0
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data))
    } else if (type === "IEND") {
      break
    }
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error("Terrain tile uses an unsupported PNG layout")
  }
  const channels = colorType === 6 ? 4 : 3
  const inflated = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  if (inflated.length !== height * (stride + 1)) {
    throw new Error("Terrain tile scanlines do not match the header")
  }
  const rgba = new Uint8Array(width * height * 4)
  const prior = new Uint8Array(stride)
  const row = new Uint8Array(stride)
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[y * (stride + 1)] ?? 0
    for (let index = 0; index < stride; index += 1) {
      const raw = inflated[y * (stride + 1) + 1 + index] ?? 0
      const left = index >= channels ? (row[index - channels] ?? 0) : 0
      const up = prior[index] ?? 0
      const upLeft = index >= channels ? (prior[index - channels] ?? 0) : 0
      row[index] = unfilterByte(filter, raw, left, up, upLeft)
    }
    prior.set(row)
    for (let x = 0; x < width; x += 1) {
      const destination = (y * width + x) * 4
      const source = x * channels
      rgba[destination] = row[source] ?? 0
      rgba[destination + 1] = row[source + 1] ?? 0
      rgba[destination + 2] = row[source + 2] ?? 0
      rgba[destination + 3] = channels === 4 ? (row[source + 3] ?? 255) : 255
    }
  }
  return { width, height, data: rgba }
}

function unfilterByte(filter: number, raw: number, left: number, up: number, upLeft: number): number {
  switch (filter) {
    case 0:
      return raw
    case 1:
      return (raw + left) & 255
    case 2:
      return (raw + up) & 255
    case 3:
      return (raw + Math.floor((left + up) / 2)) & 255
    case 4:
      return (raw + paeth(left, up, upLeft)) & 255
    default:
      throw new Error(`Terrain tile uses PNG filter ${filter}`)
  }
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft
  const distanceLeft = Math.abs(estimate - left)
  const distanceUp = Math.abs(estimate - up)
  const distanceUpLeft = Math.abs(estimate - upLeft)
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left
  if (distanceUp <= distanceUpLeft) return up
  return upLeft
}

function encodePng(raster: Raster): Buffer {
  const { width, height, data } = raster
  const stride = width * 4
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1)
    raw[rowStart] = 0
    raw.set(data.subarray(y * stride, (y + 1) * stride), rowStart + 1)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ])
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const name = Buffer.from(type)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0)
  return Buffer.concat([length, name, data, checksum])
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function clampByte(value: number): number {
  if (value < 0) return 0
  if (value > 255) return 255
  return value
}
