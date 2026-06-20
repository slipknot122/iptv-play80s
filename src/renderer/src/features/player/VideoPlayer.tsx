import React, { useRef, useEffect, useCallback, useState } from 'react'
import Hls from 'hls.js'
import { usePlayerStore } from '../../store/player.store'
import { PlayerControls } from './PlayerControls'
import { EpgSidebar } from './EpgSidebar'
import { cn } from '../../lib/utils'
import { X, Minus } from 'lucide-react'

// ============================================================
// VideoPlayer — Головний компонент відеоплеєра
// Підтримка: mpv (основний) + hls.js (резервний)
// ============================================================

interface VideoPlayerProps {
  isMini?: boolean
}

export function VideoPlayer({ isMini = false }: VideoPlayerProps): React.ReactElement {
  const {
    currentItem,
    playerState,
    stop,
    toggleMiniPlayer,
    updatePlayerState,
    syncMpvState
  } = usePlayerStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const syncTimerRef = useRef<any>(null)
  const [isEpgOpen, setIsEpgOpen] = useState(false)
  const [isHlsMode, setIsHlsMode] = useState(true) // Default: hls.js

  const isLive = currentItem?.type === 'live'

  // ResizeObserver for mpv:geometry
  useEffect(() => {
    if (isHlsMode || !containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const rect = entry.target.getBoundingClientRect()
        window.api.mpv.geometry({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [isHlsMode, isEpgOpen, playerState.isFullscreen])

  // Ініціалізація плеєра при зміні URL
  useEffect(() => {
    if (!currentItem) return

    const initPlayer = async () => {
      // Перевірка наявності mpv
      const mpvStatus = await window.api.mpv.check()
      console.log('[VideoPlayer] mpv status:', mpvStatus)

      if (mpvStatus.isAvailable) {
        // MPV режим — mpv вже запущено з main process
        console.log('[VideoPlayer] Using mpv engine')
        setIsHlsMode(false)
        updatePlayerState({ playerEngine: 'mpv' })
        startMpvSync()
      } else {
        // HLS.js резервний режим
        console.log('[VideoPlayer] mpv not available, using hls.js for:', currentItem.url)
        setIsHlsMode(true)
        updatePlayerState({ playerEngine: 'hls' })
        initHls(currentItem.url)
      }
    }

    initPlayer()

    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current)
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [currentItem?.id])

  // Синхронізація стану mpv кожну секунду
  const startMpvSync = useCallback(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current)
    syncTimerRef.current = setInterval(() => {
      syncMpvState()
    }, 1000)
  }, [syncMpvState])

  // Ініціалізація HLS.js
  const initHls = useCallback((url: string) => {
    const video = videoRef.current
    if (!video) {
      console.error('[VideoPlayer] No video element found for hls.js')
      return
    }

    // Очищаємо попередній HLS
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    console.log('[VideoPlayer] Initializing hls.js with URL:', url)

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      })

      hls.loadSource(url)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[VideoPlayer] HLS manifest parsed, starting playback')
        video.play().catch((err) => {
          console.warn('[VideoPlayer] Autoplay failed:', err)
        })
        updatePlayerState({ isLoading: false, isPlaying: true })
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('[VideoPlayer] HLS error:', data.type, data.details, data.fatal)
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('[VideoPlayer] Fatal network error, trying to recover...')
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('[VideoPlayer] Fatal media error, trying to recover...')
              hls.recoverMediaError()
              break
            default:
              console.error('[VideoPlayer] Unrecoverable error')
              updatePlayerState({ error: 'Помилка відтворення потоку', isLoading: false })
              hls.destroy()
              break
          }
        }
      })

      hlsRef.current = hls
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Нативна підтримка HLS (Safari)
      video.src = url
      video.play().catch(console.warn)
    } else {
      // Спроба прямого відтворення (для .ts та інших форматів)
      console.log('[VideoPlayer] HLS not supported, trying direct source')
      video.src = url
      video.play().catch(console.warn)
    }

    // Прив'язка подій відеоелемента
    video.onwaiting = () => updatePlayerState({ isLoading: true })
    video.onplaying = () => updatePlayerState({ isLoading: false, isPlaying: true })
    video.ontimeupdate = () => {
      updatePlayerState({
        currentTime: video.currentTime,
        duration: video.duration || 0
      })
    }
    video.onvolumechange = () => {
      updatePlayerState({ volume: Math.round(video.volume * 100), isMuted: video.muted })
    }
    video.onerror = () => {
      console.error('[VideoPlayer] Video element error:', video.error?.message)
      updatePlayerState({ error: `Помилка: ${video.error?.message || 'невідома'}`, isLoading: false })
    }
  }, [updatePlayerState])

  const resetControlsTimer = useCallback(() => {
    // No longer needed as controls are statically at bottom
  }, [])

  const handleMouseMove = useCallback(() => {
  }, [])

  // Синхронізація pause/play зі стора на відеоелемент (HLS)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isHlsMode) return

    if (playerState.isPaused && !video.paused) {
      console.log('[VideoPlayer] Syncing pause to video element')
      video.pause()
    } else if (!playerState.isPaused && video.paused) {
      console.log('[VideoPlayer] Syncing play to video element')
      video.play().catch((err) => {
        console.warn('[VideoPlayer] Sync play failed:', err)
      })
    }
  }, [playerState.isPaused, isHlsMode])

  // Синхронізація гучності зі стора на відеоелемент (HLS)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isHlsMode) return

    const targetVolume = playerState.volume / 100
    if (video.volume !== targetVolume) {
      console.log('[VideoPlayer] Syncing volume to video element:', targetVolume)
      video.volume = targetVolume
    }
  }, [playerState.volume, isHlsMode])

  // Синхронізація mute зі стора на відеоелемент (HLS)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isHlsMode) return

    if (video.muted !== playerState.isMuted) {
      console.log('[VideoPlayer] Syncing mute to video element:', playerState.isMuted)
      video.muted = playerState.isMuted
    }
  }, [playerState.isMuted, isHlsMode])

  // Синхронізація поточного часу (seek) зі стора на відеоелемент (HLS)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isHlsMode || isLive) return

    const diff = Math.abs(video.currentTime - playerState.currentTime)
    if (diff > 1.2) {
      console.log('[VideoPlayer] Syncing seek to video element:', playerState.currentTime)
      video.currentTime = playerState.currentTime
    }
  }, [playerState.currentTime, isHlsMode, isLive])

  // Клавіатурні скорочення
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentItem) return
      resetControlsTimer()

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault()
          usePlayerStore.getState().togglePause()
          break
        case 'KeyF':
          e.preventDefault()
          usePlayerStore.getState().toggleFullscreen()
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (!isLive) {
            const pos = Math.max(0, playerState.currentTime - 10)
            usePlayerStore.getState().seek(pos)
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (!isLive) {
            const pos = Math.min(playerState.duration || Infinity, playerState.currentTime + 10)
            usePlayerStore.getState().seek(pos)
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          usePlayerStore.getState().setVolume(Math.min(100, playerState.volume + 5))
          break
        case 'ArrowDown':
          e.preventDefault()
          usePlayerStore.getState().setVolume(Math.max(0, playerState.volume - 5))
          break
        case 'KeyM':
          e.preventDefault()
          usePlayerStore.getState().toggleMute()
          break
        case 'Escape':
          if (playerState.isFullscreen) {
            usePlayerStore.getState().toggleFullscreen()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentItem, playerState.volume, playerState.isMuted, playerState.currentTime, playerState.isFullscreen, isLive, isHlsMode, resetControlsTimer])

  // Очищення при unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
      }
      if (syncTimerRef.current) clearInterval(syncTimerRef.current)
    }
  }, [])

  if (!currentItem) return <></>

  // Міні-плеєр
  if (isMini) {
    return (
      <div
        ref={containerRef}
        className="fixed bottom-4 right-4 w-72 h-40 rounded-xl overflow-hidden shadow-2xl
                   border border-border/30 z-50 group"
      >
        {isHlsMode ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted={playerState.isMuted}
          />
        ) : (
          <div className="w-full h-full bg-black flex items-center justify-center">
            <div className="text-text-muted text-xs">MPV Active</div>
          </div>
        )}
        {/* Mini controls */}
        <div className={cn(
          'absolute inset-0 bg-black/50 flex items-end justify-between p-2 transition-opacity opacity-0 group-hover:opacity-100'
        )}>
          <p className="text-white text-xs font-medium truncate flex-1">{currentItem.name}</p>
          <div className="flex gap-1">
            <button onClick={toggleMiniPlayer} className="btn-icon w-6 h-6 text-white">
              <Minus className="w-3 h-3" />
            </button>
            <button onClick={stop} className="btn-icon w-6 h-6 text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Повноекранний плеєр
  return (
    <div
      className={cn(
        'absolute inset-0 bg-bg-primary z-40 flex flex-col',
        playerState.isFullscreen && 'fixed z-[9999]'
      )}
    >
      {/* Top Bar (safe from MPV OS window overlap) */}
      <div className="flex-none h-12 bg-bg-secondary border-b border-border/30 flex items-center justify-between px-4 z-50">
        <h3 className="text-white text-sm font-medium truncate pr-4">{currentItem.name}</h3>
        <div className="flex gap-2 shrink-0">
          <button onClick={toggleMiniPlayer} className="glass btn-icon rounded-lg" title="Міні-плеєр"><Minus className="w-4 h-4" /></button>
          <button onClick={stop} className="glass btn-icon rounded-lg hover:bg-error/20 hover:text-error" title="Закрити плеєр (Esc)"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Основна область: Відео + Сайдбар */}
      <div className="flex flex-1 overflow-hidden relative">
        <div ref={containerRef} className="flex-1 bg-black relative">
          {/* Відео елемент (HLS режим) */}
          {isHlsMode && (
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              autoPlay
              playsInline
            />
          )}

          {/* MPV режим — чорний фон (mpv рендерить через HWND) */}
          {!isHlsMode && (
            <div className="w-full h-full bg-black" />
          )}

          {/* Інформація про канал (лише у віконному режимі для HLS, бо для MPV є OSC) */}
          {isHlsMode && (
            <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 pointer-events-none transition-opacity">
              <div className="flex items-start gap-3">
                {currentItem.logo && (
                  <img
                    src={currentItem.logo}
                    alt={currentItem.name}
                    className="w-10 h-10 rounded-lg object-contain bg-bg-hover flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                )}
                <div>
                  <h3 className="text-white font-bold text-base leading-tight">{currentItem.name}</h3>
                  {currentItem.type === 'live' && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-white/80 text-xs font-medium">LIVE</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Бічна панель EPG */}
        {isEpgOpen && (currentItem.type === 'live' || currentItem.type === 'catchup') && !playerState.isFullscreen && (
          <div className="w-80 flex-shrink-0 bg-bg-secondary border-l border-border/30 z-50 overflow-hidden">
            <EpgSidebar
              channelId={currentItem.type === 'catchup' ? currentItem.id.split('_archive_')[0] : currentItem.id}
              providerId={currentItem.providerId}
              onClose={() => setIsEpgOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Панель керування під відео (не показуємо у повноекранному режимі) */}
      {!playerState.isFullscreen && (
        <div className="flex-none retro-control-panel z-50 relative">
          <PlayerControls 
            isLive={currentItem.type === 'live'} 
            onEpgClick={isLive ? () => setIsEpgOpen(!isEpgOpen) : undefined}
            isEpgOpen={isEpgOpen}
          />
        </div>
      )}

      {/* Loading overlay */}
      {playerState.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="w-12 h-12 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      )}

      {/* Error overlay */}
      {playerState.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="glass rounded-xl p-6 text-center max-w-sm">
            <div className="w-12 h-12 rounded-full bg-error/20 flex items-center justify-center mx-auto mb-3">
              <span className="text-error text-xl">!</span>
            </div>
            <p className="text-text-secondary font-medium">Помилка відтворення</p>
            <p className="text-text-muted text-sm mt-1">{playerState.error}</p>
            <button
              onClick={stop}
              className="btn-primary mt-4 text-sm"
            >
              Закрити
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
