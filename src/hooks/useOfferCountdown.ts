import { useEffect, useState } from 'react'

const STORAGE_KEY = 'ninebot-shop-countdown-end'
const DURATION_MS = 24 * 60 * 60 * 1000

function getOrCreateEndTime(): number {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const parsed = Number(stored)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  const end = Date.now() + DURATION_MS
  localStorage.setItem(STORAGE_KEY, String(end))
  return end
}

function formatUnit(value: number): string {
  return String(value).padStart(2, '0')
}

export function useOfferCountdown(): {
  hours: string
  minutes: string
  seconds: string
  expired: boolean
} {
  const [endTime] = useState(getOrCreateEndTime)
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, endTime - Date.now()),
  )

  useEffect(() => {
    const tick = () => {
      setRemainingMs(Math.max(0, endTime - Date.now()))
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [endTime])

  const totalSeconds = Math.floor(remainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    hours: formatUnit(hours),
    minutes: formatUnit(minutes),
    seconds: formatUnit(seconds),
    expired: remainingMs <= 0,
  }
}
