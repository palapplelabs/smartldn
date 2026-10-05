import assert from "node:assert/strict"
import { MESSAGES } from "./i18n.ts"
import { boardFailedCopy, boardFaultSnapshot, clearBoardFault, markBoardFault } from "./board-status.ts"

assert.equal(boardFailedCopy("citybus", MESSAGES["zh-HK"]), "未能取得城巴到站時間。")
assert.notEqual(boardFailedCopy("citybus", MESSAGES["zh-HK"]), MESSAGES["zh-HK"].citybusNone)

markBoardFault({ operator: "citybus", id: "002155", name: "保泰街" })
markBoardFault({ operator: "citybus", id: "002155", name: "保泰街" })
assert.equal(boardFaultSnapshot().length, 1)
assert.equal(boardFaultSnapshot()[0]?.name, "保泰街")

clearBoardFault("citybus", "002155")
assert.deepEqual(boardFaultSnapshot(), [])

console.log("board-status-ok")
