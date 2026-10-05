// The New Lantao catalogue stays on the server. The phone only needs this box
// so a view of Kowloon does not ask for Lantau stops.
export function inLantau(lng: number, lat: number): boolean {
  return lng >= 113.8 && lng <= 114.05 && lat >= 22.18 && lat <= 22.34
}
