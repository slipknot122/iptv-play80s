/// <reference types="vite/client" />

// ============================================================
// Типи для window.api (preload bridge)
// ============================================================

interface Window {
  api: {
    providers: {
      list: () => Promise<import('./lib/types').Provider[]>
      addXtream: (data: unknown) => Promise<{ success: boolean; error?: string; provider?: unknown }>
      addM3U: (data: unknown) => Promise<{ success: boolean; error?: string; provider?: unknown }>
      delete: (id: string) => Promise<{ success: boolean }>
      update: (id: string, updates: unknown) => Promise<{ success: boolean }>
      browseM3U: () => Promise<string | null>
    }
    live: {
      categories: (providerId: string) => Promise<{ success: boolean; data?: import('./lib/types').Category[]; error?: string }>
      channels: (providerId: string, categoryId?: string) => Promise<{ success: boolean; data?: import('./lib/types').Channel[]; error?: string }>
      catchupUrl: (providerId: string, channelId: string, startTimeMs: number, durationMinutes: number) => Promise<{ success: boolean; data?: string; error?: string }>
    }
    epg: {
      short: (providerId: string, channelId: string, epgId?: string) => Promise<{ success: boolean; data?: import('./lib/types').EpgProgram[]; error?: string }>
      full: (providerId: string, channelId: string, epgId?: string) => Promise<{ success: boolean; data?: import('./lib/types').EpgProgram[]; error?: string }>
      onProgress: (callback: (data: { status: string; percent?: number }) => void) => () => void
    }
    vod: {
      categories: (providerId: string) => Promise<{ success: boolean; data?: import('./lib/types').VodCategory[]; error?: string }>
      movies: (providerId: string, categoryId?: string) => Promise<{ success: boolean; data?: import('./lib/types').Movie[]; error?: string }>
      info: (providerId: string, movieId: string) => Promise<{ success: boolean; data?: import('./lib/types').MovieInfo; error?: string }>
    }
    series: {
      categories: (providerId: string) => Promise<{ success: boolean; data?: import('./lib/types').SeriesCategory[]; error?: string }>
      list: (providerId: string, categoryId?: string) => Promise<{ success: boolean; data?: import('./lib/types').Series[]; error?: string }>
      info: (providerId: string, seriesId: string) => Promise<{ success: boolean; data?: import('./lib/types').SeriesInfo; error?: string }>
    }
    mpv: {
      check: () => Promise<{ isAvailable: boolean; mpvPath?: string }>
      play: (url: string, wid?: number[]) => Promise<{ success: boolean; error?: string }>
      load: (url: string) => Promise<{ success: boolean }>
      pause: (paused: boolean) => Promise<{ success: boolean }>
      seek: (position: number) => Promise<{ success: boolean }>
      volume: (vol: number) => Promise<{ success: boolean }>
      state: () => Promise<{ success: boolean; data?: { position: number; duration: number; volume: number; paused: boolean; isRunning: boolean } }>
      stop: () => Promise<{ success: boolean }>
      onEvent: (callback: (event: { type: string; error?: string }) => void) => () => void
    }
    settings: {
      get: () => Promise<import('./lib/types').AppSettings>
      set: (settings: Partial<import('./lib/types').AppSettings>) => Promise<{ success: boolean }>
    }
    favorites: {
      get: () => Promise<{ channels: string[]; movies: string[]; series: string[] }>
      toggle: (type: 'channels' | 'movies' | 'series', id: string) => Promise<{ success: boolean; isFavorite: boolean }>
    }
    resume: {
      save: (id: string, position: number, duration: number) => Promise<{ success: boolean }>
      get: (id: string) => Promise<{ position: number; duration: number; updatedAt: number } | null>
    }
    lastPlayed: {
      set: (data: { type: string; providerId: string; itemId: string }) => Promise<{ success: boolean }>
      get: () => Promise<{ type?: string; providerId?: string; itemId?: string }>
    }
  }
}
