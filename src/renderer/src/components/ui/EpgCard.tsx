import React from 'react'
import type { EpgProgram } from '../../lib/types'
import { decodeBase64 } from '../../lib/utils'

interface EpgCardProps {
  current?: EpgProgram
}

export const EpgCard: React.FC<EpgCardProps> = ({ current }) => {
  if (!current) {
    return (
      <div className="mt-2 flex items-center justify-center py-2 px-1 rounded-md bg-black/20">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-white/30">Немає розкладу</span>
      </div>
    )
  }

  const formatTime = (ts: number | string) => {
    if (!ts) return '';
    // Handle both Unix timestamps and string timestamps
    const date = typeof ts === 'number' 
      ? new Date(ts > 9999999999 ? ts : ts * 1000) 
      : new Date(ts);
      
    if (isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat(navigator.language, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  // Calculate progress for current program
  let progressPercent = 0
  if (current && current.startTime && current.endTime) {
    const now = Date.now()
    
    // Normalize to ms
    const startMs = current.startTime > 9999999999 ? current.startTime : current.startTime * 1000;
    const endMs = current.endTime > 9999999999 ? current.endTime : current.endTime * 1000;
    
    if (now >= startMs && endMs > startMs) {
      progressPercent = ((now - startMs) / (endMs - startMs)) * 100
      progressPercent = Math.min(100, Math.max(0, progressPercent))
    }
  }

  return (
    <div className="mt-2">
      <div className="relative overflow-hidden rounded-md bg-white/5 p-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="text-xs font-semibold text-white/90 line-clamp-1" title={decodeBase64(current.title)}>
            {decodeBase64(current.title)}
          </h4>
          <span className="text-[10px] font-medium text-accent whitespace-nowrap shrink-0 bg-accent/10 px-1 rounded">
            {formatTime(current.startTime)} - {formatTime(current.endTime)}
          </span>
        </div>
        
        {current.description && (
          <p className="text-[10px] text-white/50 line-clamp-2 leading-tight" title={decodeBase64(current.description)}>
            {decodeBase64(current.description)}
          </p>
        )}
        
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-white/5">
          <div 
            className="h-full bg-accent shadow-[0_0_8px_rgba(var(--color-accent),0.8)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}
