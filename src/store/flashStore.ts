import { create } from 'zustand'

export type FlashStatus =
  | 'idle'
  | 'preparing'
  | 'flashing'
  | 'verifying'
  | 'done'
  | 'error'

interface FlashStoreState {
  flashStatus: FlashStatus
  progress: number
  currentChunk: number
  totalChunks: number
  error: string | null
  cancelRequested: boolean
}

interface FlashStoreActions {
  setFlashStatus: (flashStatus: FlashStatus) => void
  setProgress: (progress: number, currentChunk: number, totalChunks: number) => void
  setError: (error: string | null) => void
  requestCancel: () => void
  resetFlash: () => void
}

const initialState: FlashStoreState = {
  flashStatus: 'idle',
  progress: 0,
  currentChunk: 0,
  totalChunks: 0,
  error: null,
  cancelRequested: false,
}

export const useFlashStore = create<FlashStoreState & FlashStoreActions>((set) => ({
  ...initialState,
  setFlashStatus: (flashStatus) => set({ flashStatus }),
  setProgress: (progress, currentChunk, totalChunks) =>
    set({ progress, currentChunk, totalChunks }),
  setError: (error) => set({ error }),
  requestCancel: () => set({ cancelRequested: true }),
  resetFlash: () => set({ ...initialState }),
}))
