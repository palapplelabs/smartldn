import { copyFile, mkdir } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist")
const out = join(process.cwd(), "public", "maplibre")

await mkdir(out, { recursive: true })
for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(join(dist, name), join(out, name))
}
