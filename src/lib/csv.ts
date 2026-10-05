export function parseCsv(text: string): Record<string, string>[] {
  const source = text.replace(/^\uFEFF/, "")
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else if (char !== "\r") {
      cell += char
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  const header = rows[0]?.map((name) => name.trim()) ?? []
  if (header.length === 0) return []

  return rows.slice(1).flatMap((values) => {
    if (values.every((value) => value.trim() === "")) return []
    const record: Record<string, string> = {}
    header.forEach((name, index) => {
      record[name] = (values[index] ?? "").trim()
    })
    return [record]
  })
}
