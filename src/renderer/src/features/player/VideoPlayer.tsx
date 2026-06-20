import React, { useRef, useEffect, useCallback, useState } from 'react'
import Hls from 'hls.js'
import { usePlayerStore } from '../../store/player.store'
import { PlayerOverlay } from './PlayerOverlay'
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
  const controlsTimerRef = useRef<any>(null)
  const [showControls, setShowControls] = useState(true)
  const [isHlsMode, setIsHlsMode] = useState(true) // Default: hls.js

  const isLive = currentItem?.type === 'live'

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

  // Авто-приховання controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => {
      if (playerState.isPlaying) setShowControls(false)
    }, 3000)
  }, [playerState.isPlaying])

  const handleMouseMove = useCallback(() => {
    resetControlsTimer()
  }, [resetControlsTimer])

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
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    }
  }, [])

  if (!currentItem) return <></>

  // Міні-плеєр
  if (isMini) {
    return (
      <div
        className="fixed bottom-4 right-4 w-72 h-40 rounded-xl overflow-hidden shadow-2xl
                   border border-border/30 z-50 group"
        onMouseMove={handleMouseMove}
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
          'absolute inset-0 bg-black/50 flex items-end justify-between p-2 transition-opacity',
          showControls ? 'opacity-100' : 'opacity-0'
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
      ref={containerRef}
      className={cn(
        'absolute inset-0 bg-black z-40 flex flex-col',
        playerState.isFullscreen && 'fixed z-[9999]'
      )}
      onMouseMove={handleMouseMove}
      onClick={resetControlsTimer}
    >
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

      {/* Overlay з інформацією та controls */}
      <PlayerOverlay
        item={currentItem}
        isVisible={showControls}
      />

      {/* Кнопки закрити / міні */}
      <div
        className={cn(
          'absolute top-4 right-4 flex gap-2 transition-opacity duration-200',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      >
        <button
          onClick={toggleMiniPlayer}
          className="glass btn-icon rounded-lg"
          title="Міні-плеєр"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={stop}
          className="glass btn-icon rounded-lg hover:bg-error/20 hover:text-error"
          title="Закрити плеєр (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

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
