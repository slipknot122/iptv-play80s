import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// ============================================================
// Preload Script — Безпечний bridge між main і renderer
// Всі IPC виклики йдуть через цей файл
// ============================================================

// Типізований API для renderer
const api = {
  // ----- Провайдери -----
  providers: {
    list: () => ipcRenderer.invoke('providers:list'),
    addXtream: (data: unknown) => ipcRenderer.invoke('providers:add-xtream', data),
    addM3U: (data: unknown) => ipcRenderer.invoke('providers:add-m3u', data),
    delete: (id: string) => ipcRenderer.invoke('providers:delete', id),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('providers:update', id, updates),
    browseM3U: () => ipcRenderer.invoke('providers:browse-m3u')
  },

  // ----- Live TV -----
  live: {
    categories: (providerId: string) => ipcRenderer.invoke('live:categories', providerId),
    channels: (providerId: string, categoryId?: string) =>
      ipcRenderer.invoke('live:channels', providerId, categoryId),
    catchupUrl: (providerId: string, channelId: string, startTimeMs: number, durationMinutes: number) =>
      ipcRenderer.invoke('live:catchup-url', providerId, channelId, startTimeMs, durationMinutes)
  },

  // ----- EPG -----
  epg: {
    short: (providerId: string, channelId: string, epgId?: string) => ipcRenderer.invoke('epg:short', providerId, channelId, epgId),
    full: (providerId: string, channelId: string, epgId?: string) => ipcRenderer.invoke('epg:full', providerId, channelId, epgId),
    onProgress: (callback) => {
      const handler = (_e, data) => callback(data)
      ipcRenderer.on('epg:progress', handler)
      return () => ipcRenderer.off('epg:progress', handler)
    }
  },

  // ----- VOD -----
  vod: {
    categories: (providerId: string) => ipcRenderer.invoke('vod:categories', providerId),
    movies: (providerId: string, categoryId?: string) =>
      ipcRenderer.invoke('vod:movies', providerId, categoryId),
    info: (providerId: string, movieId: string) =>
      ipcRenderer.invoke('vod:info', providerId, movieId)
  },

  // ----- Серіали -----
  series: {
    categories: (providerId: string) => ipcRenderer.invoke('series:categories', providerId),
    list: (providerId: string, categoryId?: string) =>
      ipcRenderer.invoke('series:list', providerId, categoryId),
    info: (providerId: string, seriesId: string) =>
      ipcRenderer.invoke('series:info', providerId, seriesId)
  },

  // ----- MPV Плеєр -----
  mpv: {
    check: () => ipcRenderer.invoke('mpv:check'),
    play: (url: string, wid?: number[]) => ipcRenderer.invoke('mpv:play', url, wid),
    load: (url: string) => ipcRenderer.invoke('mpv:load', url),
    pause: (paused: boolean) => ipcRenderer.invoke('mpv:pause', paused),
    seek: (position: number) => ipcRenderer.invoke('mpv:seek', position),
    volume: (vol: number) => ipcRenderer.invoke('mpv:volume', vol),
    state: () => ipcRenderer.invoke('mpv:state'),
    stop: () => ipcRenderer.invoke('mpv:stop'),
    geometry: (rect: {x: number, y: number, width: number, height: number}) => ipcRenderer.invoke('mpv:geometry', rect),
    // Підписка на події mpv
    onEvent: (callback: (event: { type: string; error?: string }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, event: { type: string; error?: string }) =>
        callback(event)
      ipcRenderer.on('mpv:event', handler)
      return () => ipcRenderer.removeListener('mpv:event', handler)
    }
  },

  // ----- Налаштування -----
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: unknown) => ipcRenderer.invoke('settings:set', settings)
  },

  // ----- Обрані -----
  favorites: {
    get: () => ipcRenderer.invoke('favorites:get'),
    toggle: (type: 'channels' | 'movies' | 'series', id: string) =>
      ipcRenderer.invoke('favorites:toggle', type, id)
  },

  // ----- Resume позиції -----
  resume: {
    save: (id: string, position: number, duration: number) =>
      ipcRenderer.invoke('resume:save', id, position, duration),
    get: (id: string) => ipcRenderer.invoke('resume:get', id)
  },

  // ----- Останній перегляд -----
  lastPlayed: {
    set: (data: { type: string; providerId: string; itemId: string }) =>
      ipcRenderer.invoke('last-played:set', data),
    get: () => ipcRenderer.invoke('last-played:get')
  }
}

// Безпечна ексопозиція через contextBridge
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (для не-isolated режиму)
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
