import assert from "node:assert/strict"
import {
  carryArrivalClock,
  estimateTrains,
  metresBetween,
  pathsToward,
  projectTrain,
  segmentMinutes,
  trainsFromVehicles,
  type EstimateRoute,
  type GeoPoint,
  type EstimatedTrain,
  type TrainObservation,
} from "./train-estimate.ts"
import { advanceRuns, mergeRuns, runCollection, type TrainRun } from "./train-run.ts"

const now = Date.parse("2026-10-01T05:40:00Z")

const places: Record<string, GeoPoint> = {}
place("A", 0)
place("B", 1440)
place("C", 2880)
place("BR1", 0)
place("BR2", 0)
place("JCT", 1440)
place("MID", 2880)
place("END", 4320)

const line = routes("LIN", [
  ["UP", ["A", "B", "C"]],
  ["DOWN", ["C", "B", "A"]],
])
const branched = routes("BRL", [
  ["UT", ["BR1", "JCT", "MID", "END"]],
  ["BR2-UT", ["BR2", "JCT", "MID", "END"]],
  ["DT", ["END", "MID", "JCT", "BR1"]],
  ["BR2-DT", ["END", "MID", "JCT", "BR2"]],
])

const oneTrain = estimateTrains(line, [obs("B", "C", 1, 1), obs("C", "C", 3, 3)], locate)
assert.equal(oneTrain.length, 1)
const oneSpot = projectTrain(oneTrain[0]!, locate, now)
assert.ok(oneSpot)
assert.equal(oneSpot.from, "A")
assert.equal(oneSpot.to, "B")
assert.equal(oneSpot.clamp, "none")
assert.ok(Math.abs(oneSpot.lat - midpoint("A", "B")) < 1e-4)

const twoTrains = estimateTrains(
  line,
  [obs("B", "C", 1, 1), obs("B", "C", 5, 5), obs("C", "C", 3, 3), obs("C", "C", 7, 7)],
  locate,
)
assert.equal(twoTrains.length, 2)

const branchOnly = estimateTrains(branched, [obs("MID", "END", 10, 10, "BRL")], locate)
assert.equal(branchOnly.length, 1)
const held = projectTrain(branchOnly[0]!, locate, now)
assert.ok(held)
assert.equal(held.from, "JCT")
assert.equal(held.to, "JCT")
assert.equal(held.clamp, "junction")
assert.equal(branchOnly[0]!.path.includes("BR1") || branchOnly[0]!.path.includes("BR2"), true)
assert.equal(branchOnly[0]!.hold.includes("BR1"), false)
assert.equal(branchOnly[0]!.hold.includes("BR2"), false)

const fromBranch = estimateTrains(branched, [obs("BR1", "END", 1, 1, "BRL")], locate)
assert.equal(fromBranch.length, 1)
assert.equal(fromBranch[0]!.path[0], "BR1")
assert.equal(fromBranch[0]!.hold.includes("BR1"), true)

const departure = estimateTrains(
  line,
  [{ ...obs("B", "C", 2, 2), timeType: "D" }],
  locate,
)
assert.equal(departure.length, 1)
assert.equal(departure[0]!.timeType, "D")
const atPlatform = projectTrain(departure[0]!, locate, now)
assert.ok(atPlatform)
assert.equal(atPlatform.from, "B")
assert.equal(atPlatform.to, "B")
assert.equal(atPlatform.clamp, "none")

const coarse = estimateTrains(line, [obs("B", "C", 1, 1), obs("C", "C", 4, 4)], locate)
assert.equal(coarse.length, 1)

const urban: EstimateRoute[] = [
  { id: "URB-DT", line: "URB", stations: ["P", "Q", "R", "S"] },
  { id: "URB-UT", line: "URB", stations: ["S", "R", "Q", "P"] },
]
place("P", 0)
place("Q", 720)
place("R", 1440)
place("S", 2160)
const sameTrain = estimateTrains(
  urban,
  [obs("Q", "S", 1, 1, "URB"), obs("R", "S", 2, 2, "URB")],
  locate,
)
assert.equal(sameTrain.length, 1)
const following = estimateTrains(
  urban,
  [obs("Q", "S", 1, 1, "URB"), obs("R", "S", 0, 0, "URB")],
  locate,
)
assert.equal(following.length, 2)

const differentTrains = estimateTrains(line, [obs("B", "C", 1, 1), obs("C", "C", 8, 8)], locate)
assert.equal(differentTrains.length, 2)

const queued = estimateTrains(line, [obs("A", "C", 3, 3), obs("A", "C", 7, 7), obs("A", "C", 11, 11)], locate)
assert.equal(queued.length, 1)
assert.equal(queued[0]!.ttnt, 3)

const leftBehind = estimateTrains(line, [obs("B", "C", 0, 0), obs("C", "C", 1, 1)], locate)
assert.equal(leftBehind.length, 1)
const leftSpot = projectTrain(leftBehind[0]!, locate, now)
assert.ok(leftSpot)
assert.equal(leftSpot.from, "B")
assert.equal(leftSpot.to, "C")

const dwellThenRun = projectTrain({ ...obsTrain("B", "C", 0), path: ["A", "B", "C"], hold: ["A", "B", "C"] }, locate, now + 90_000)
assert.ok(dwellThenRun)
assert.equal(dwellThenRun.from, "B")
assert.equal(dwellThenRun.to, "C")
assert.ok(dwellThenRun.lat > (places.B?.lat ?? 0) && dwellThenRun.lat < (places.C?.lat ?? 0))

const rollsOut = projectTrain({ ...obsTrain("B", "C", 2), timeType: "D", path: ["A", "B", "C"], hold: ["A", "B", "C"] }, locate, now + 3 * 60_000)
assert.ok(rollsOut)
assert.equal(rollsOut.from, "B")
assert.equal(rollsOut.to, "C")

const moving = advanceRuns([sampleRun(0, 12)], 5, locate)
assert.equal(moving.length, 1)
assert.ok((moving[0]?.distance ?? 0) > 50)
assert.ok((moving[0]?.speed ?? 0) > 3)

const behind = mergeRuns([sampleRun(800, 12)], [sampleRun(200, 12)], now + 1000)
const kept = behind.find((run) => run.id === "keep")
assert.ok(kept)
assert.equal(kept.distance, 800)

const far = mergeRuns([sampleRun(100, 12)], [{ ...sampleRun(3000, 12), id: "other" }], now + 1000)
assert.equal(far.find((run) => run.id === "keep")?.distance, 100)
assert.equal(far.some((run) => run.id === "other"), true)

const carried = carryArrivalClock(
  [{ ...obs("B", "C", 0, 0), observedAt: now - 60_000, dueAt: now - 60_000 }],
  [obs("B", "C", 0, 0)],
)
assert.equal(carried[0]!.observedAt, now - 60_000)

const departures = estimateTrains(
  line,
  [
    { ...obs("B", "C", 2, 2), timeType: "D" },
    { ...obs("B", "C", 9, 9), timeType: "D" },
  ],
  locate,
)
assert.equal(departures.length, 1)
assert.equal(departures[0]!.ttnt, 2)

const loop: EstimateRoute[] = [
  { id: "LOOP-UT", line: "LOOP", stations: ["WST", "CTR", "EST"] },
  { id: "LOOP-DT", line: "LOOP", stations: ["EST", "CTR", "WST"] },
]
assert.deepEqual(pathsToward(loop, "LOOP", "EST"), [["WST", "CTR", "EST"]])
assert.deepEqual(pathsToward(loop, "LOOP", "WST"), [["EST", "CTR", "WST"]])

const segment = segmentMinutes(metresBetween(places.A!, places.B!))
assert.ok(Math.abs(segment - 2) < 0.05)

const sameWay = runCollection([
  spotRun("lead", 1400),
  spotRun("rear", 0),
  spotRun("mid", 30),
  { ...spotRun("other", 0), dest: "A" },
], locate)
assert.equal(sameWay.features.length, 3)
assert.deepEqual(sameWay.features.map((feature) => feature.properties?.id).sort(), ["lead", "mid", "other"])

// A named train needs no chaining: its soonest call is its next station, and its
// other calls pick the branch.
const named = trainsFromVehicles(
  branched,
  [
    { ...obs("MID", "END", 2, 2, "BRL"), vehicle: "201" },
    { ...obs("END", "END", 5, 5, "BRL"), vehicle: "201" },
    { ...obs("JCT", "END", 1, 1, "BRL"), vehicle: "202" },
  ],
  locate,
)
assert.equal(named.length, 2)
const first = named.find((train) => train.id.endsWith("|201"))
assert.ok(first)
assert.equal(first.anchor, "MID")
assert.equal(first.ttnt, 2)
assert.deepEqual(first.hold, first.path)
assert.equal(trainsFromVehicles(branched, [obs("MID", "END", 2, 2, "BRL")], locate).length, 0)

console.log("train estimate ok")

function sampleRun(distance: number, speed: number): TrainRun {
  return {
    id: "keep",
    line: "LIN",
    dest: "C",
    path: ["A", "B", "C"],
    distance,
    speed,
    cruise: speed,
    color: "#000",
    plat: "1",
    delay: false,
    timeType: "A",
    seenAt: now,
  }
}

function obsTrain(station: string, dest: string, ttnt: number): EstimatedTrain {
  return {
    id: "t",
    line: "LIN",
    dest,
    plat: "1",
    ttnt,
    observedAt: now,
    delay: false,
    timeType: "A",
    anchor: station,
    path: ["A", "B", "C"],
    hold: ["A", "B", "C"],
  }
}

function obs(
  station: string,
  dest: string,
  ttnt: number,
  dueMinutes: number,
  lineCode = "LIN",
): TrainObservation {
  return {
    line: lineCode,
    station,
    dest,
    plat: "1",
    ttnt,
    dueAt: now + dueMinutes * 60_000,
    observedAt: now,
    delay: false,
    timeType: "A",
  }
}

function routes(lineCode: string, legs: [string, string[]][]): EstimateRoute[] {
  return legs.map(([direction, stations]) => ({ id: `${lineCode}-${direction}`, line: lineCode, stations }))
}

function spotRun(id: string, distance: number): TrainRun {
  return {
    id,
    line: "LIN2",
    dest: "C",
    path: ["A", "B", "C"],
    distance,
    speed: 12,
    cruise: 12,
    color: "#f80",
    plat: "1",
    delay: false,
    timeType: "A",
    seenAt: now,
  }
}

function place(code: string, metresNorth: number) {
  places[code] = { lng: -0.1, lat: latNorth(metresNorth) }
}

function latNorth(metres: number): number {
  let delta = metres / 111_320
  const origin = 51.45
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const got = metresBetween({ lng: -0.1, lat: origin }, { lng: -0.1, lat: origin + delta })
    if (got === 0) break
    delta *= metres / got
  }
  return origin + delta
}

function locate(code: string): GeoPoint | null {
  return places[code] ?? null
}

function midpoint(from: string, to: string): number {
  return ((places[from]?.lat ?? 0) + (places[to]?.lat ?? 0)) / 2
}
