import React, { useEffect, useState } from 'react'
import { Heart, Play, CalendarDays } from 'lucide-react'
import type { Channel, EpgProgram } from '../../lib/types'
import { useContentStore } from '../../store/content.store'
import { usePlayerStore, useUIStore } from '../../store/player.store'
import { cn, decodeBase64 } from '../../lib/utils'
import { EpgCard } from '../../components/ui/EpgCard'

// ============================================================
// ChannelCard — Картка каналу з EPG
// ============================================================

interface ChannelCardProps {
  channel: Channel
  index?: number
  onShowEpg?: () => void
}

export function ChannelCard({ channel, index, onShowEpg }: ChannelCardProps): React.ReactElement {
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

  const currentProgram = channel.currentProgram || epg[0]

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
      {/* Номер */}
      {index !== undefined && (
        <div className="text-white/30 font-mono text-lg font-bold min-w-[28px] text-right z-10 transition-colors group-hover:text-white/50">
          {index}
        </div>
      )}

      {/* Лого */}
      <div className="w-14 h-14 flex-shrink-0 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center overflow-hidden p-1 z-10 shadow-inner">
        {channel.logo && !logoError ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="w-6 h-6 text-white/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="4" width="20" height="14" rx="2" />
              <path d="M8 20h8M12 18v2" />
            </svg>
          </div>
        )}
      </div>

      {/* Назва + EPG */}
      <div className="flex-1 min-w-0 flex flex-col justify-center py-1 z-10">
        <p className="text-white text-base font-bold leading-tight truncate drop-shadow-md mb-2 group-hover:text-accent transition-colors">
          {channel.name}
        </p>
        
        {/* Вбудований детальний EPG */}
        {currentProgram ? (
          <div className="flex flex-col gap-1.5">
            {/* Поточна передача */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-accent/90 bg-accent/10 px-1.5 py-0.5 rounded shrink-0">
                {new Date(currentProgram.startTime > 9999999999 ? currentProgram.startTime : currentProgram.startTime * 1000).toLocaleTimeString(navigator.language, { hour: '2-digit', minute: '2-digit' })}
              </span>
              <p className="text-[13px] text-white/90 line-clamp-1 font-medium">
                {decodeBase64(currentProgram.title)}
              </p>
            </div>
            
            {/* Опис поточної передачі (якщо є) */}
            {currentProgram.description && (
              <p className="text-[11px] text-white/50 line-clamp-1 pl-[3.25rem]">
                {decodeBase64(currentProgram.description)}
              </p>
            )}

            {/* Прогрес-бар */}
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden mt-0.5 mb-0.5">
              <div 
                className="h-full bg-accent rounded-full" 
                style={{ 
                  width: `${(() => {
                    const now = Date.now()
                    const s = currentProgram.startTime > 9999999999 ? currentProgram.startTime : currentProgram.startTime * 1000
                    const e = currentProgram.endTime > 9999999999 ? currentProgram.endTime : currentProgram.endTime * 1000
                    if (now < s) return 0
                    if (now > e) return 100
                    return ((now - s) / (e - s)) * 100
                  })()}%` 
                }} 
              />
            </div>

            {/* Наступна передача */}
            {(() => {
              const nextProgram = epg.find(p => p.startTime > currentProgram.startTime)
              if (!nextProgram) return null
              return (
                <div className="flex items-center gap-2 opacity-60">
                  <span className="text-[10px] font-medium text-white/50 px-1.5 py-0.5 rounded shrink-0">
                    {new Date(nextProgram.startTime > 9999999999 ? nextProgram.startTime : nextProgram.startTime * 1000).toLocaleTimeString(navigator.language, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <p className="text-[11px] text-white/60 line-clamp-1">
                    {decodeBase64(nextProgram.title)}
                  </p>
                </div>
              )
            })()}
          </div>
        ) : (
          <div className="text-xs text-white/30 uppercase tracking-wider font-semibold mt-2">Немає розкладу</div>
        )}
      </div>

      {/* Кнопки */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pr-2">
        {onShowEpg && (
          <button
            onClick={(e) => { e.stopPropagation(); onShowEpg() }}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors bg-black/40 shadow-sm border border-white/5 hover:border-white/20 hover:text-white text-white/70"
            title="Програма передач"
          >
            <CalendarDays className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleToggleFavorite}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors bg-black/40 shadow-sm border border-white/5 hover:border-white/20"
          title={channel.isFavorite ? 'Прибрати з обраних' : 'Додати до обраних'}
        >
          <Heart
            className={cn(
              'w-4 h-4 transition-colors',
              channel.isFavorite ? 'fill-red-500 text-red-500' : 'text-white/70 hover:text-white'
            )}
          />
        </button>
      </div>

      {/* Активний індикатор */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent shadow-[0_0_10px_rgba(var(--color-accent),1)]" />
      )}
      
      {/* Play Overlay - subtly appearing in background on hover */}
      {!isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/0 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}
    </div>
  )
}
