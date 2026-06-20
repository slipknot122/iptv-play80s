import Store from 'electron-store'
import type { AppSettings, XtreamProvider, M3UProvider } from '../renderer/src/lib/types'

// ============================================================
// electron-store — Схема даних застосунку
// ============================================================

interface StoreSchema {
  providers: Array<XtreamProvider | M3UProvider>
  settings: AppSettings
  favorites: {
    channels: string[]  // channel IDs
    movies: string[]    // movie IDs
    series: string[]    // series IDs
  }
  resumePositions: Record<string, {
    position: number    // секунди
    duration: number
    updatedAt: number
  }>
  lastPlayed: {
    type?: 'live' | 'movie' | 'series'
    providerId?: string
    itemId?: string
  }
  windowState: {
    width: number
    height: number
    x?: number
    y?: number
    isMaximized: boolean
  }
}

const defaultSettings: AppSettings = {
  preferredEngine: 'mpv',
  streamFormat: 'm3u8',
  autoRefreshInterval: 30,
  theme: 'dark',
  language: 'uk'
}

// Ініціалізація store з типізованою схемою
export const store = new Store<StoreSchema>({
  name: 'iptv-player-config',
  defaults: {
    providers: [],
    settings: defaultSettings,
    favorites: {
      channels: [],
      movies: [],
      series: []
    },
    resumePositions: {},
    lastPlayed: {},
    windowState: {
      width: 1280,
      height: 800,
      isMaximized: false
    }
  }
})

export type { StoreSchema }
