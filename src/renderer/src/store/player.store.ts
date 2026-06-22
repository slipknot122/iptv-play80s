import { create } from 'zustand'
import type { PlaybackItem, PlayerState } from '../lib/types'

// ============================================================
// Store плеєра
// ============================================================

interface PlayerStoreState {
  currentItem: PlaybackItem | null
  playerState: PlayerState
  isVisible: boolean
  isMiniPlayer: boolean
  // Зберігаємо час останньої дії користувача, щоб уникнути конфліктів зі стейтом MPV
  lastUserActionTime: number
  // Дії
  play: (item: PlaybackItem) => Promise<void>
  stop: () => Promise<void>
  togglePause: () => Promise<void>
  seek: (position: number) => Promise<void>
  setVolume: (volume: number) => Promise<void>
  toggleMute: () => void
  toggleFullscreen: () => void
  toggleMiniPlayer: () => void
  updatePlayerState: (updates: Partial<PlayerState>) => void
  syncMpvState: () => Promise<void>
}

const defaultPlayerState: PlayerState = {
  isPlaying: false,
  isPaused: false,
  isLoading: false,
  isFullscreen: false,
  isPip: false,
  volume: 100,
  isMuted: false,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  playerEngine: 'mpv'
}

export const usePlayerStore = create<PlayerStoreState>((set, get) => ({
  currentItem: null,
  playerState: defaultPlayerState,
  isVisible: false,
  isMiniPlayer: false,
  lastUserActionTime: 0,

  play: async (item) => {
    const { playerState } = get()
    set({
      currentItem: item,
      isVisible: true,
      playerState: {
        ...playerState,
        isLoading: true,
        isPlaying: false,
        isPaused: false,
        currentTime: 0,
        duration: item.totalDuration || 0
      }
    })

    // Зберігаємо в "останній перегляд"
    await window.api.lastPlayed.set({
      type: item.type === 'live' ? 'live' : item.type === 'movie' ? 'movie' : 'series',
      providerId: item.providerId,
      itemId: item.id
    })

    // Завантажуємо resume позицію для VOD
    let startPosition = item.startPosition || 0
    if (item.type !== 'live') {
      const resume = await window.api.resume.get(item.id)
      if (resume && resume.position > 30) {
        startPosition = resume.position
      }
    }

    // Запускаємо mpv або hls.js
    const mpvStatus = await window.api.mpv.check()
    const isMpvAvailable = mpvStatus.success ? mpvStatus.data?.available : mpvStatus.available
    const engine = isMpvAvailable ? 'mpv' : 'hls'

    if (engine === 'mpv') {
      try {
        let res
        if (await window.api.mpv.state().then((s) => s.data?.isRunning)) {
          res = await window.api.mpv.load(item.url)
        } else {
          res = await window.api.mpv.play(item.url)
        }
        
        // Force UI to show video immediately
        set({ playerState: { ...get().playerState, isLoading: false, isPlaying: true } })
        
        // Перевіряємо чи користувач не натиснув stop поки ми чекали mpv
        if (get().currentItem?.id !== item.id) return

        if (!res.success) {
          set({
            playerState: { ...get().playerState, isLoading: false, error: (res as any).error || 'Failed to play' }
          })
          return
        }

        if (startPosition > 0) {
          await window.api.mpv.seek(startPosition)
        }
      } catch (err) {
        if (get().currentItem?.id !== item.id) return
        set({
          playerState: { ...get().playerState, isLoading: false, error: (err as Error).message }
        })
        return
      }
    }

    set({
      playerState: {
        ...get().playerState,
        isLoading: true, // Завжди залишаємо true, поки не отримаємо подію 'play' (для mpv) або 'playing' (для hls)
        isPlaying: false, // Аналогічно, false доки не почнеться відтворення
        isPaused: false,
        playerEngine: engine
      }
    })
  },

  stop: async () => {
    const { currentItem, playerState } = get()

    // Зберігаємо позицію для VOD
    if (currentItem && currentItem.type !== 'live' && playerState.currentTime > 0) {
      await window.api.resume.save(
        currentItem.id,
        playerState.currentTime,
        playerState.duration
      )
    }

    await window.api.mpv.stop()
    set({
      currentItem: null,
      isVisible: false,
      isMiniPlayer: false,
      playerState: defaultPlayerState
    })
  },

  togglePause: async () => {
    const { playerState } = get()
    const newPaused = !playerState.isPaused
    
    set({
      lastUserActionTime: Date.now(),
      playerState: {
        ...playerState,
        isPaused: newPaused,
        isPlaying: !newPaused
      }
    })

    if (playerState.playerEngine === 'mpv') {
      window.api.mpv.pause(newPaused).catch(err => console.error('MPV pause error:', err))
    }
  },

  seek: async (position) => {
    const { playerState } = get()
    
    set((state) => ({
      lastUserActionTime: Date.now(),
      playerState: { ...state.playerState, currentTime: position }
    }))

    if (playerState.playerEngine === 'mpv') {
      window.api.mpv.seek(position).catch(err => console.error('MPV seek error:', err))
    }
  },

  setVolume: async (volume) => {
    const { playerState } = get()
    
    set((state) => ({
      lastUserActionTime: Date.now(),
      playerState: { ...state.playerState, volume, isMuted: volume === 0 }
    }))

    if (playerState.playerEngine === 'mpv') {
      window.api.mpv.volume(volume).catch(err => console.error('MPV volume error:', err))
    }
  },

  toggleMute: () => {
    const { playerState } = get()
    const newMuted = !playerState.isMuted
    
    set({ 
      lastUserActionTime: Date.now(),
      playerState: { ...playerState, isMuted: newMuted } 
    })

    if (playerState.playerEngine === 'mpv') {
      window.api.mpv.volume(newMuted ? 0 : playerState.volume).catch(err => console.error('MPV mute error:', err))
    }
  },

  toggleFullscreen: () => {
    const isFullscreen = !get().playerState.isFullscreen
    window.api.window.setFullscreen(isFullscreen)
    set((state) => ({
      playerState: { ...state.playerState, isFullscreen }
    }))
  },

  toggleMiniPlayer: () => {
    set((state) => ({ isMiniPlayer: !state.isMiniPlayer }))
  },

  updatePlayerState: (updates) => {
    set((state) => ({
      playerState: { ...state.playerState, ...updates }
    }))
  },

  syncMpvState: async () => {
    const { playerState, lastUserActionTime } = get()
    if (playerState.playerEngine !== 'mpv') return

    // Якщо користувач щойно змінив стан (пауза, перемотка), ігноруємо бекенд 1.5 сек
    if (Date.now() - lastUserActionTime < 1500) {
      return
    }

    try {
      const result = await window.api.mpv.state()
      if (result.success && result.data) {
        set((s) => {
          // Повторна перевірка на випадок, якщо під час await користувач щось натиснув
          if (Date.now() - s.lastUserActionTime < 1500) return s

          const { position, duration, volume, paused, isRunning } = result.data!
          return {
            playerState: {
              ...s.playerState,
              currentTime: position,
              // Keep old duration if MPV returns 0 but we already know the duration
              duration: duration > 0 ? duration : s.playerState.duration,
              volume,
              isPaused: paused,
              isPlaying: isRunning && !paused,
              isLoading: !isRunning
            }
          }
        })
      }
    } catch {
      // ігноруємо помилки синхронізації
    }
  }
}))

// ============================================================
// Store UI (активна секція, пошук)
// ============================================================

type Section = 'live' | 'movies' | 'series' | 'favorites' | 'settings' | 'providers'

interface UIState {
  activeSection: Section
  activeProviderId: string | null
  searchQuery: string
  isSearchOpen: boolean
  isSidebarExpanded: boolean
  epgSyncStatus: { status: string; percent?: number } | null
  // Дії
  setActiveSection: (section: Section) => void
  setActiveProvider: (id: string | null) => void
  setSearchQuery: (query: string) => void
  toggleSearch: () => void
  toggleSidebar: () => void
  setEpgSyncStatus: (status: { status: string; percent?: number } | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeSection: 'live',
  activeProviderId: null,
  searchQuery: '',
  isSearchOpen: false,
  isSidebarExpanded: true,
  epgSyncStatus: null,

  setActiveSection: (section) => set({ activeSection: section, searchQuery: '' }),
  setActiveProvider: (id) => set({ activeProviderId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen, searchQuery: '' })),
  toggleSidebar: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),
  setEpgSyncStatus: (status) => set({ epgSyncStatus: status })
}))
