import { create } from 'zustand'
import type {
  Channel,
  Category,
  Movie,
  Series,
  VodCategory,
  SeriesCategory,
  LoadingStatus
} from '../lib/types'
import { useUIStore } from './player.store'

// ============================================================
// Store контенту (Live TV, VOD, Серіали)
// ============================================================

interface ContentState {
  // Live TV
  liveCategories: Category[]
  channels: Channel[]
  liveCategoriesStatus: LoadingStatus
  channelsStatus: LoadingStatus
  selectedLiveCategory: string | null

  // VOD
  vodCategories: VodCategory[]
  movies: Movie[]
  vodCategoriesStatus: LoadingStatus
  moviesStatus: LoadingStatus
  selectedVodCategory: string | null

  // Серіали
  seriesCategories: SeriesCategory[]
  seriesList: Series[]
  seriesCategoriesStatus: LoadingStatus
  seriesListStatus: LoadingStatus
  selectedSeriesCategory: string | null

  // Обрані
  favoriteChannelIds: string[]
  favoriteMovieIds: string[]
  favoriteSeriesIds: string[]

  // Останнє оновлення
  lastUpdated: number | null

  // Дії
  loadLiveCategories: (providerId: string) => Promise<void>
  loadChannels: (providerId: string, categoryId?: string) => Promise<void>
  loadVodCategories: (providerId: string) => Promise<void>
  loadMovies: (providerId: string, categoryId?: string) => Promise<void>
  loadSeriesCategories: (providerId: string) => Promise<void>
  loadSeriesList: (providerId: string, categoryId?: string) => Promise<void>
  loadFavorites: () => Promise<void>
  toggleFavoriteChannel: (channelId: string) => Promise<void>
  toggleFavoriteMovie: (movieId: string) => Promise<void>
  toggleFavoriteSeries: (seriesId: string) => Promise<void>
  setSelectedLiveCategory: (id: string | null) => void
  setSelectedVodCategory: (id: string | null) => void
  setSelectedSeriesCategory: (id: string | null) => void
  refreshAll: (providerId: string) => Promise<void>
  
  fetchCurrentXmltvPrograms: () => Promise<void>
  syncProviderEpg: (providerId: string) => Promise<void>
}

export const useContentStore = create<ContentState>((set, get) => ({
  // Live TV
  liveCategories: [],
  channels: [],
  liveCategoriesStatus: 'idle',
  channelsStatus: 'idle',
  selectedLiveCategory: null,

  // VOD
  vodCategories: [],
  movies: [],
  vodCategoriesStatus: 'idle',
  moviesStatus: 'idle',
  selectedVodCategory: null,

  // Серіали
  seriesCategories: [],
  seriesList: [],
  seriesCategoriesStatus: 'idle',
  seriesListStatus: 'idle',
  selectedSeriesCategory: null,

  // Обрані
  favoriteChannelIds: [],
  favoriteMovieIds: [],
  favoriteSeriesIds: [],
  lastUpdated: null,

  // ----- Live TV -----

  loadLiveCategories: async (providerId) => {
    set({ liveCategoriesStatus: 'loading' })
    try {
      const result = await window.api.live.categories(providerId)
      console.log('[ContentStore] loadLiveCategories result:', result.success, result.error || '')
      if (result.success) {
        set({ liveCategories: result.data, liveCategoriesStatus: 'success' })
      } else {
        console.error('[ContentStore] loadLiveCategories failed:', result.error)
        set({ liveCategoriesStatus: 'error' })
      }
    } catch (err) {
      console.error('[ContentStore] loadLiveCategories exception:', err)
      set({ liveCategoriesStatus: 'error' })
    }
  },

  loadChannels: async (providerId, categoryId) => {
    set({ channelsStatus: 'loading' })
    try {
      const result = await window.api.live.channels(providerId, categoryId)
      console.log('[ContentStore] loadChannels result:', result.success, 'count:', result.data?.length, result.error || '')
      if (result.success && result.data) {
        // Позначаємо обрані
        const { favoriteChannelIds } = get()
        const channels = result.data.map((ch: Channel) => ({
          ...ch,
          isFavorite: favoriteChannelIds.includes(ch.id)
        }))
        set({ channels, channelsStatus: 'success', lastUpdated: Date.now() })
        
        // Автоматично пробуємо підтягнути вже закешований EPG з бекенду
        get().fetchCurrentXmltvPrograms()
      } else {
        console.error('[ContentStore] loadChannels failed:', result.error)
        set({ channelsStatus: 'error' })
      }
    } catch (err) {
      console.error('[ContentStore] loadChannels exception:', err)
      set({ channelsStatus: 'error' })
    }
  },

  // ----- VOD -----

  loadVodCategories: async (providerId) => {
    set({ vodCategoriesStatus: 'loading' })
    try {
      const result = await window.api.vod.categories(providerId)
      if (result.success) {
        set({ vodCategories: result.data, vodCategoriesStatus: 'success' })
      } else {
        set({ vodCategoriesStatus: 'error' })
      }
    } catch {
      set({ vodCategoriesStatus: 'error' })
    }
  },

  loadMovies: async (providerId, categoryId) => {
    set({ moviesStatus: 'loading' })
    try {
      const result = await window.api.vod.movies(providerId, categoryId)
      if (result.success && result.data) {
        const { favoriteMovieIds } = get()
        const movies = result.data.map((m: Movie) => ({
          ...m,
          isFavorite: favoriteMovieIds.includes(m.id)
        }))
        set({ movies, moviesStatus: 'success', lastUpdated: Date.now() })
      } else {
        set({ moviesStatus: 'error' })
      }
    } catch {
      set({ moviesStatus: 'error' })
    }
  },

  // ----- Серіали -----

  loadSeriesCategories: async (providerId) => {
    set({ seriesCategoriesStatus: 'loading' })
    try {
      const result = await window.api.series.categories(providerId)
      if (result.success) {
        set({ seriesCategories: result.data, seriesCategoriesStatus: 'success' })
      } else {
        set({ seriesCategoriesStatus: 'error' })
      }
    } catch {
      set({ seriesCategoriesStatus: 'error' })
    }
  },

  loadSeriesList: async (providerId, categoryId) => {
    set({ seriesListStatus: 'loading' })
    try {
      const result = await window.api.series.list(providerId, categoryId)
      if (result.success && result.data) {
        const { favoriteSeriesIds } = get()
        const seriesList = result.data.map((s: Series) => ({
          ...s,
          isFavorite: favoriteSeriesIds.includes(s.id)
        }))
        set({ seriesList, seriesListStatus: 'success', lastUpdated: Date.now() })
      } else {
        set({ seriesListStatus: 'error' })
      }
    } catch {
      set({ seriesListStatus: 'error' })
    }
  },

  // ----- Обрані -----

  loadFavorites: async () => {
    const favorites = await window.api.favorites.get()
    set({
      favoriteChannelIds: favorites.channels,
      favoriteMovieIds: favorites.movies,
      favoriteSeriesIds: favorites.series
    })
  },

  toggleFavoriteChannel: async (channelId) => {
    const result = await window.api.favorites.toggle('channels', channelId)
    set((state) => ({
      favoriteChannelIds: result.isFavorite
        ? [...state.favoriteChannelIds, channelId]
        : state.favoriteChannelIds.filter((id) => id !== channelId),
      channels: state.channels.map((ch) =>
        ch.id === channelId ? { ...ch, isFavorite: result.isFavorite } : ch
      )
    }))
  },

  toggleFavoriteMovie: async (movieId) => {
    const result = await window.api.favorites.toggle('movies', movieId)
    set((state) => ({
      favoriteMovieIds: result.isFavorite
        ? [...state.favoriteMovieIds, movieId]
        : state.favoriteMovieIds.filter((id) => id !== movieId),
      movies: state.movies.map((m) =>
        m.id === movieId ? { ...m, isFavorite: result.isFavorite } : m
      )
    }))
  },

  toggleFavoriteSeries: async (seriesId) => {
    const result = await window.api.favorites.toggle('series', seriesId)
    set((state) => ({
      favoriteSeriesIds: result.isFavorite
        ? [...state.favoriteSeriesIds, seriesId]
        : state.favoriteSeriesIds.filter((id) => id !== seriesId),
      seriesList: state.seriesList.map((s) =>
        s.id === seriesId ? { ...s, isFavorite: result.isFavorite } : s
      )
    }))
  },

  // ----- UI -----

  setSelectedLiveCategory: (id) => set({ selectedLiveCategory: id }),
  setSelectedVodCategory: (id) => set({ selectedVodCategory: id }),
  setSelectedSeriesCategory: (id) => set({ selectedSeriesCategory: id }),

  // ----- Оновлення -----

  refreshAll: async (providerId) => {
    const { selectedLiveCategory, selectedVodCategory, selectedSeriesCategory } = get()
    await Promise.all([
      get().loadChannels(providerId, selectedLiveCategory || undefined),
      get().loadMovies(providerId, selectedVodCategory || undefined),
      get().loadSeriesList(providerId, selectedSeriesCategory || undefined)
    ])
  },

  fetchCurrentXmltvPrograms: async () => {
    const { channels } = get()
    if (!channels.length) return

    const epgIds = Array.from(new Set(channels.map(c => c.epgId || c.name || c.id)))
    const result = await window.api.epg.getCurrentXmltvPrograms(epgIds)
    if (result.success && result.data) {
      const newChannels = channels.map(ch => {
        const idToLookup = ch.epgId || ch.name || ch.id
        const programs = result.data![idToLookup]
        if (programs && programs.length > 0) {
          return {
            ...ch,
            currentProgram: programs[0],
            nextProgram: programs[1]
          }
        }
        return ch
      })
      set({ channels: newChannels })
    }
  },

  syncProviderEpg: async (providerId) => {
    const providers = await window.api.providers.list()
    const p = providers.find(p => p.id === providerId)
    if (p && p.epgUrl) {
      useUIStore.getState().setEpgSyncStatus({ status: 'Syncing EPG...' })
      const result = await window.api.epg.syncXmltv(p.epgUrl)
      if (result.success) {
        useUIStore.getState().setEpgSyncStatus({ status: 'Done', percent: 100 })
        setTimeout(() => useUIStore.getState().setEpgSyncStatus(null), 2000)
        await get().fetchCurrentXmltvPrograms()
      } else {
        useUIStore.getState().setEpgSyncStatus({ status: 'Failed' })
        setTimeout(() => useUIStore.getState().setEpgSyncStatus(null), 3000)
      }
    }
  }
}))
