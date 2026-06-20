import React, { useCallback } from 'react'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  List
} from 'lucide-react'
import { usePlayerStore } from '../../store/player.store'
import { cn, formatDuration } from '../../lib/utils'

// ============================================================
// PlayerControls — Контроли відтворення
// ============================================================

interface PlayerControlsProps {
  isLive?: boolean
  onEpgClick?: () => void
  isEpgOpen?: boolean
}

export function PlayerControls({ isLive = false, onEpgClick, isEpgOpen = false }: PlayerControlsProps): React.ReactElement {
  const {
    playerState,
    togglePause,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen
  } = usePlayerStore()

  const { isPlaying, isPaused, volume, isMuted, currentTime, duration, isFullscreen } = playerState

  // Прогрес від 0 до 1
  const progress = duration > 0 ? currentTime / duration : 0

  const handleSeekClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isLive || duration <= 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = (e.clientX - rect.left) / rect.width
      seek(Math.max(0, Math.min(duration, ratio * duration)))
    },
    [isLive, duration, seek]
  )

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVolume(parseInt(e.target.value))
    },
    [setVolume]
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Прогрес-бар (тільки для VOD) */}
      {!isLive && duration > 0 && (
        <div
          className="w-full h-1 bg-white/20 rounded-full cursor-pointer group relative"
          onClick={handleSeekClick}
        >
          {/* Прогрес */}
          <div
            className="h-full bg-accent rounded-full relative transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          >
            {/* Thumb */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full 
                         shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </div>
      )}

      {/* Контроли */}
      <div className="flex items-center gap-2">
        {/* Перемотка назад (тільки для VOD) */}
        {!isLive && (
          <button
            onClick={() => seek(Math.max(0, currentTime - 10))}
            className="retro-dial w-10 h-10"
            title="−10 сек"
          >
            <SkipBack className="w-4 h-4" />
          </button>
        )}

        {/* Play/Pause */}
        <button
          onClick={togglePause}
          className="retro-dial w-14 h-14"
          title={isPlaying ? 'Пауза (пробіл)' : 'Відтворити (пробіл)'}
        >
          {isPaused || !isPlaying ? (
            <Play className="w-6 h-6 fill-current ml-1" />
          ) : (
            <Pause className="w-6 h-6 fill-current" />
          )}
        </button>

        {/* Перемотка вперед (тільки для VOD) */}
        {!isLive && (
          <button
            onClick={() => seek(Math.min(duration || Infinity, currentTime + 10))}
            className="retro-dial w-10 h-10"
            title="+10 сек"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        )}

        {/* Час */}
        {!isLive && (
          <div className="text-white/70 text-xs font-mono ml-1">
            {formatDuration(currentTime)}
            {duration > 0 && ` / ${formatDuration(duration)}`}
          </div>
        )}

        {/* LIVE badge */}
        {isLive && (
          <div className="flex items-center gap-1.5 ml-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white/80 text-xs font-bold tracking-wide">НАЖИВО</span>
          </div>
        )}

        {/* Роздільник */}
        <div className="flex-1" />

        {/* Гучність */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="retro-dial w-10 h-10"
            title="Звук (M)"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1 appearance-none bg-white/20 rounded-full cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                       [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
            title={`Гучність: ${volume}%`}
          />
        </div>

        {/* EPG / Телепрограма */}
        {isLive && onEpgClick && (
          <button
            onClick={onEpgClick}
            className={cn(
              "retro-dial w-10 h-10 transition-colors",
              isEpgOpen ? "ring-2 ring-white" : ""
            )}
            title="Телепрограма (EPG)"
          >
            <List className="w-4 h-4" />
          </button>
        )}

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="retro-dial w-10 h-10"
          title={isFullscreen ? 'Згорнути (F/Esc)' : 'На весь екран (F/F11)'}
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4" />
          ) : (
            <Maximize className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  )
}
