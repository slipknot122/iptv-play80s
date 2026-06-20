import React, { useEffect, useCallback } from 'react'
import { useProvidersStore, useSettingsStore } from './store/providers.store'
import { useContentStore } from './store/content.store'
import { useUIStore, usePlayerStore } from './store/player.store'
import { Sidebar } from './components/Sidebar'
import { LivePage } from './features/live/LivePage'
import { VodPage } from './features/vod/VodPage'
import { SeriesPage } from './features/series/SeriesPage'
import { FavoritesPage } from './features/favorites/FavoritesPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { ProvidersPage } from './features/providers/ProvidersPage'
import { VideoPlayer } from './features/player/VideoPlayer'
import { ToastContainer } from './components/ui/ToastContainer'
import { EpgProgressToast } from './components/ui/EpgProgressToast'

// ============================================================
// Головний компонент застосунку
// ============================================================

export default function App(): React.ReactElement {
  const { providers, loadProviders } = useProvidersStore()
  const { loadSettings, settings } = useSettingsStore()
  const { loadFavorites, refreshAll } = useContentStore()
  const { activeSection, activeProviderId, setActiveProvider, setEpgSyncStatus } = useUIStore()
  const { isVisible, isMiniPlayer } = usePlayerStore()

  // Початкова ініціалізація
  useEffect(() => {
    const init = async () => {
      await Promise.all([loadProviders(), loadSettings(), loadFavorites()])
    }
    init()
  }, [])

  // Підписка на події прогресу EPG
  useEffect(() => {
    if (window.api?.epg?.onProgress) {
      const cleanup = window.api.epg.onProgress((data) => {
        setEpgSyncStatus(data)
      })
      return cleanup
    }
  }, [setEpgSyncStatus])

  // Встановлення активного провайдера при завантаженні
  useEffect(() => {
    if (providers.length > 0 && !activeProviderId) {
      const firstActive = providers.find((p) => p.isActive)
      if (firstActive) {
        setActiveProvider(firstActive.id)
      }
    }
  }, [providers, activeProviderId])

  // Автоматичне оновлення контенту
  const setupAutoRefresh = useCallback(() => {
    if (!settings || !activeProviderId) return
    const interval = settings.autoRefreshInterval
    if (interval <= 0) return

    const timer = setInterval(() => {
      refreshAll(activeProviderId)
    }, interval * 60 * 1000)

    return () => clearInterval(timer)
  }, [settings, activeProviderId])

  useEffect(() => {
    return setupAutoRefresh()
  }, [setupAutoRefresh])

  // Підписка на події mpv (оновлення стану плеєра)
  useEffect(() => {
    const { updatePlayerState } = usePlayerStore.getState()
    const unsubscribe = window.api.mpv.onEvent((event) => {
      switch (event.type) {
        case 'play':
          updatePlayerState({ isPlaying: true, isPaused: false, isLoading: false })
          break
        case 'pause':
          updatePlayerState({ isPaused: true, isPlaying: false })
          break
        case 'ended':
          updatePlayerState({ isPlaying: false, isLoading: false })
          break
        case 'error':
          updatePlayerState({ isLoading: false, error: event.error })
          break
      }
    })
    return unsubscribe
  }, [])

  // Рендер активної секції
  const renderSection = () => {
    switch (activeSection) {
      case 'live':      return <LivePage />
      case 'movies':    return <VodPage />
      case 'series':    return <SeriesPage />
      case 'favorites': return <FavoritesPage />
      case 'settings':  return <SettingsPage />
      case 'providers': return <ProvidersPage />
      default:          return <LivePage />
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden synthwave-bg neon-theme p-4 gap-4 select-none relative">
      <div className="synthwave-sun"></div>
      
      {/* Ліва панель */}
      <div className="relative z-20 w-[280px] flex flex-col neon-panel p-5 overflow-hidden">
        <div className="sidebar-fog"></div>
        {/* Логотип */}
        <div className="flex flex-col items-center justify-center py-4 mb-4 border-b border-neon-magenta border-opacity-50 relative z-10">
          <h1 className="font-special text-4xl font-bold tracking-widest text-[#fff] drop-shadow-[0_0_15px_#ff00ff]">
            IPTV<span className="text-neon-cyan drop-shadow-[0_0_15px_#00f3ff]">Player</span>
          </h1>
          <p className="text-[10px] tracking-[0.3em] text-neon-magenta mt-1 font-special font-bold uppercase drop-shadow-[0_0_5px_#ff00ff]">
            80s Edition
          </p>
        </div>
        
        {/* Вбудований Sidebar */}
        <div className="flex-1 overflow-hidden z-10">
          <Sidebar />
        </div>
      </div>

      {/* Права панель (Контент) */}
      <div className="flex-1 flex flex-col overflow-hidden relative neon-panel p-4">
        
        {/* Основний "екран" */}
        <div className="flex flex-1 overflow-hidden relative bg-transparent rounded-lg border border-neon-cyan/20">
          
          {/* Основний контент */}
          <main className="flex-1 overflow-hidden relative z-10">
            {renderSection()}
          </main>

          {/* Відеоплеєр (оверлей або міні-плеєр) */}
          {isVisible && <VideoPlayer isMini={isMiniPlayer} />}

          {/* Toast повідомлення */}
          <ToastContainer />
          <EpgProgressToast />
        </div>
      </div>
    </div>
  )
}
