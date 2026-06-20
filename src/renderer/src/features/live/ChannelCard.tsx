import React, { useEffect, useState } from 'react'
import { Heart, Play } from 'lucide-react'
import type { Channel, EpgProgram } from '../../lib/types'
import { useContentStore } from '../../store/content.store'
import { usePlayerStore, useUIStore } from '../../store/player.store'
import { cn, formatTime, getEpgProgress, truncate } from '../../lib/utils'

// ============================================================
// ChannelCard — Картка каналу з EPG
// ============================================================

interface ChannelCardProps {
  channel: Channel
}

export function ChannelCard({ channel }: ChannelCardProps): React.ReactElement {
  const { toggleFavoriteChannel } = useContentStore()
  const { currentItem, play } = usePlayerStore()
  const { activeProviderId } = useUIStore()
  const [epg, setEpg] = useState<EpgProgram[]>([])
  const [logoError, setLogoError] = useState(false)

  const isActive = currentItem?.id === channel.id

  // Завантаження EPG при mount
  useEffect(() => {
    if (!activeProviderId) return
    let isMounted = true

    const loadEpg = async () => {
      try {
        const result = await window.api.epg.short(activeProviderId, channel.id, channel.epgId)
        if (result.success && isMounted) {
          setEpg(result.data || [])
        }
      } catch {
        // EPG може бути недоступним
      }
    }

    loadEpg()
    return () => { isMounted = false }
  }, [channel.id, activeProviderId])

  const currentProgram = epg[0]
  const nextProgram = epg[1]
  const progress = currentProgram
    ? getEpgProgress(currentProgram.startTime, currentProgram.endTime)
    : 0

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await play({
      type: 'live',
      id: channel.id,
      name: channel.name,
      url: channel.streamUrl,
      logo: channel.logo,
      providerId: channel.providerId
    })
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await toggleFavoriteChannel(channel.id)
  }

  return (
    <div
      className={cn('channel-card group', isActive && 'active')}
      onClick={handlePlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handlePlay(e as unknown as React.MouseEvent)}
    >
      {/* Верхня частина: лого + назва */}
      <div className="p-2.5 flex items-start gap-2.5">
        {/* Лого */}
        <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-bg-hover flex items-center justify-center overflow-hidden">
          {channel.logo && !logoError ? (
            <img
              src={channel.logo}
              alt={channel.name}
              className="w-full h-full object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-6 h-6 text-text-muted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="4" width="20" height="14" rx="2" />
                <path d="M8 20h8M12 18v2" />
              </svg>
            </div>
          )}
        </div>

        {/* Назва + EPG */}
        <div className="flex-1 min-w-0">
          <p className="text-text-primary text-xs font-semibold leading-tight truncate">
            {channel.name}
          </p>
          {currentProgram ? (
            <p className="text-text-muted text-[10px] leading-tight mt-0.5 truncate">
              {truncate(currentProgram.title, 30)}
            </p>
          ) : (
            <p className="text-text-muted text-[10px] leading-tight mt-0.5">Немає EPG</p>
          )}
          {nextProgram && (
            <p className="text-text-muted text-[10px] leading-tight opacity-60 truncate">
              Далі: {truncate(nextProgram.title, 25)}
            </p>
          )}
        </div>

        {/* Кнопки */}
        <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Обране */}
          <button
            onClick={handleToggleFavorite}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover transition-colors"
            title={channel.isFavorite ? 'Прибрати з обраних' : 'Додати до обраних'}
          >
            <Heart
              className={cn(
                'w-3 h-3',
                channel.isFavorite ? 'fill-red-500 text-red-500' : 'text-text-muted'
              )}
            />
          </button>
        </div>
      </div>

      {/* EPG progress bar */}
      {currentProgram && progress > 0 && (
        <div className="px-2.5 pb-2">
          <div className="epg-progress">
            <div
              className="epg-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] text-text-muted">
              {formatTime(currentProgram.startTime)}
            </span>
            <span className="text-[9px] text-accent font-medium">{progress}%</span>
            <span className="text-[9px] text-text-muted">
              {formatTime(currentProgram.endTime)}
            </span>
          </div>
        </div>
      )}

      {/* Play overlay при hover */}
      {isActive && (
        <div className="absolute inset-0 bg-accent/10 rounded-lg flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shadow-lg">
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </div>
        </div>
      )}
    </div>
  )
}
