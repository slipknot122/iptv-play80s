import { create } from 'zustand'

export interface DownloadProgress {
  url: string
  progress: number
  downloaded: number
  total: number
}

interface DownloadState {
  downloads: Record<string, DownloadProgress>
  initDownload: (url: string) => void
  setDownloadProgress: (progress: DownloadProgress) => void
  removeDownload: (url: string) => void
  cancelDownload: (url: string) => Promise<void>
}

export const useDownloadStore = create<DownloadState>((set) => ({
  downloads: {},
  initDownload: (url) => set((state) => ({
    downloads: {
      ...state.downloads,
      [url]: { url, progress: -1, downloaded: 0, total: 0 }
    }
  })),
  setDownloadProgress: (progress) => set((state) => ({
    downloads: { ...state.downloads, [progress.url]: progress }
  })),
  removeDownload: (url) => set((state) => {
    const newDownloads = { ...state.downloads }
    delete newDownloads[url]
    return { downloads: newDownloads }
  }),
  cancelDownload: async (url) => {
    try {
      await window.api?.download?.cancel?.(url)
    } catch (err) {
      console.error('Failed to cancel download', err)
    }
    set((state) => {
      const newDownloads = { ...state.downloads }
      delete newDownloads[url]
      return { downloads: newDownloads }
    })
  }
}))
