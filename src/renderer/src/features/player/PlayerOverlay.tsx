import React, { useState } from 'react'
import type { PlaybackItem } from '../../lib/types'
import { PlayerControls } from './PlayerControls'
import { EpgSidebar } from './EpgSidebar'
import { cn } from '../../lib/utils'

// ============================================================
// PlayerOverlay — Оверлей з інформацією та контролами
// ============================================================

interface PlayerOverlayProps {
  item: PlaybackItem
  isVisible: boolean
}

export function PlayerOverlay({
  item,
  isVisible
}: PlayerOverlayProps): React.ReactElement {
  const isLive = item.type === 'live' || item.type === 'catchup'
  const [isEpgOpen, setIsEpgOpen] = useState(false)

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col justify-between transition-opacity duration-300 pointer-events-none',
        isVisible || isEpgOpen ? 'opacity-100' : 'opacity-0'
      )}
    >
      {/* Верхня частина — інформація про канал/медіа */}
      <div className="bg-gradient-to-b from-black/80 to-transparent p-4 pointer-events-auto">
        <div className="flex items-start gap-3">
          {/* Лого/постер */}
          {item.logo && (
            <img
              src={item.logo}
              alt={item.name}
              className="w-10 h-10 rounded-lg object-contain bg-bg-hover flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div>
            <h3 className="text-white font-bold text-base leading-tight">{item.name}</h3>
            {/* Для серіалів показуємо сезон/епізод */}
            {item.type === 'series_episode' && (
              <p className="text-white/70 text-sm">
                Сезон {item.seasonNum}, Епізод {item.episodeNum}
              </p>
            )}
            {/* Live індикатор */}
            {item.type === 'live' && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white/80 text-xs font-medium">LIVE</span>
              </div>
            )}
            {/* Archive індикатор */}
            {item.type === 'catchup' && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-white/80 text-xs font-medium uppercase tracking-wide">Запис (Архів)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Бічна панель EPG */}
      {isEpgOpen && (item.type === 'live' || item.type === 'catchup') && (
        <EpgSidebar
          channelId={item.type === 'catchup' ? item.id.split('_archive_')[0] : item.id}
          providerId={item.providerId}
          onClose={() => setIsEpgOpen(false)}
        />
      )}

      {/* Нижня частина — контроли */}
      <div className="retro-control-panel pointer-events-auto z-40">
        <PlayerControls 
          isLive={item.type === 'live'} 
          onEpgClick={isLive ? () => setIsEpgOpen(!isEpgOpen) : undefined}
          isEpgOpen={isEpgOpen}
        />
      </div>
    </div>
  )
}
