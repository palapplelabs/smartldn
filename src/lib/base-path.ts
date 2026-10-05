// The site can live under a path prefix (labs.palapple.com/smartldn). Next adds
// the prefix to pages and assets; requests built by hand need it added here.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`
}
