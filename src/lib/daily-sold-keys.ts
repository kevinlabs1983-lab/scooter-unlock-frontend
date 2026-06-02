/** Deterministischer Tageswert 89–147 (gleicher Wert pro UTC-Tag). */
export function getDailySoldKeysCount(): number {
  const seed = new Date().toISOString().slice(0, 10)
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const min = 89
  const max = 147
  return min + (Math.abs(hash) % (max - min + 1))
}
