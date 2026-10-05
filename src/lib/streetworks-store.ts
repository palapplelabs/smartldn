import { appendFile, mkdir } from "node:fs/promises"
import { join } from "node:path"

// Street Manager notifications arrive one at a time over SNS. Each one is kept as
// a line of JSON, one file per day, in STREETWORKS_DIR (outside the release, so
// a deploy does not wipe it). The map layer will read these back.
export async function saveStreetworksEvent(event: Record<string, unknown>, now = new Date()): Promise<void> {
  const dir = process.env.STREETWORKS_DIR || join(process.cwd(), "var", "streetworks")
  await mkdir(dir, { recursive: true })
  const day = now.toISOString().slice(0, 10)
  await appendFile(join(dir, `events-${day}.jsonl`), `${JSON.stringify({ receivedAt: now.toISOString(), ...event })}\n`, "utf8")
}
