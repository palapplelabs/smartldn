import assert from "node:assert/strict"
import { boardFaultSnapshot, clearBoardFault, markBoardFault } from "./board-status.ts"

markBoardFault({ id: "490013767X", name: "Northumberland Avenue / Trafalgar Square" })
markBoardFault({ id: "490013767X", name: "Northumberland Avenue / Trafalgar Square" })
assert.equal(boardFaultSnapshot().length, 1)
assert.equal(boardFaultSnapshot()[0]?.name, "Northumberland Avenue / Trafalgar Square")

clearBoardFault("490013767X")
assert.deepEqual(boardFaultSnapshot(), [])

console.log("board-status-ok")
