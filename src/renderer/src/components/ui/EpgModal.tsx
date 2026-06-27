import React, { useEffect, useState } from 'react'
import { X, Tv, CalendarDays, Play } from 'lucide-react'
import type { Channel, EpgProgram } from '../../lib/types'
import { useUIStore, usePlayerStore } from '../../store/player.store'
import { decodeBase64, formatTime, formatDate } from '../../lib/utils'

interface EpgModalProps {
  channel: Channel
  onClose: () => void
}

export function EpgModal({ channel, onClose }: EpgModalProps): React.ReactElement {
  const { activeProviderId } = useUIStore()
  const { play } = usePlayerStore()
  const [epg, setEpg] = useState<EpgProgram[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const handlePlayArchive = async (program: EpgProgram) => {
    if (!channel || !channel.hasArchive || !activeProviderId) return
    const startMs = program.startTime > 9999999999 ? program.startTime : program.startTime * 1000
    const endMs = program.endTime > 9999999999 ? program.endTime : program.endTime * 1000
    const durationMinutes = Math.round((endMs - startMs) / 60000)
    
    try {
      const res = await window.api.live.catchupUrl(activeProviderId, channel.id, startMs, durationMinutes)
      if (res.success && res.data) {
        await play({
          type: 'catchup',
          id: `${channel.id}_archive_${program.startTime}`,
          name: decodeBase64(program.title),
          url: res.data,
          logo: channel.logo,
          providerId: activeProviderId,
          totalDuration: durationMinutes * 60
        })
        onClose()
      }
    } catch (e) {
      console.error('Failed to play archive', e)
    }
  }

  useEffect(() => {
    if (!activeProviderId) return
    let isMounted = true

    const loadEpg = async () => {
      setIsLoading(true)
      try {
        // Завантажуємо повний EPG
        const result = await window.api.epg.full(activeProviderId, channel.id, channel.epgId)
        if (result.success && isMounted) {
          setEpg(result.data || [])
        }
      } catch (err) {
        console.error('Failed to load EPG', err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadEpg()
    return () => { isMounted = false }
  }, [channel.id, activeProviderId])

  // Групуємо EPG по датах
  const groupedEpg = epg.reduce((acc, program) => {
    const ts = program.startTime > 9999999999 ? program.startTime : program.startTime * 1000
    const dateStr = formatDate(ts)
    if (!acc[dateStr]) acc[dateStr] = []
    acc[dateStr].push(program)
    return acc
  }, {} as Record<string, EpgProgram[]>)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-bg-secondary rounded-xl shadow-2xl border border-border/30 flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center gap-4 p-4 border-b border-border/20 bg-bg-hover/50 rounded-t-xl">
          <div className="w-12 h-12 rounded-lg bg-bg-hover flex items-center justify-center overflow-hidden shrink-0">
            {channel.logo ? (
              <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain" />
            ) : (
              <Tv className="w-6 h-6 text-text-muted" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-text-primary truncate">{channel.name}</h2>
            <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Телепрограма</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : epg.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-text-muted">
              <CalendarDays className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">Для цього каналу немає телепрограми</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedEpg).map(([date, programs]) => (
                <div key={date}>
                  <div className="sticky top-0 bg-bg-secondary/95 backdrop-blur py-2 z-10 mb-2">
                    <h3 className="text-xs font-bold text-accent uppercase tracking-wider">{date}</h3>
                  </div>
                  <div className="space-y-2">
                    {programs.map((prog, idx) => {
                      const startMs = prog.startTime > 9999999999 ? prog.startTime : prog.startTime * 1000
                      const endMs = prog.endTime > 9999999999 ? prog.endTime : prog.endTime * 1000
                      const isPast = Date.now() > endMs
                      const isCurrent = Date.now() >= startMs && Date.now() <= endMs
                      
                      const canWatchArchive = isPast && channel?.hasArchive && 
                        (Date.now() - endMs <= (channel.archiveDays || 0) * 24 * 60 * 60 * 1000)

                      return (
                        <div 
                          key={idx} 
                          className={`flex gap-3 p-3 rounded-lg border group relative ${
                            isCurrent 
                              ? 'bg-accent/10 border-accent/30 shadow-[0_0_15px_rgba(var(--color-accent),0.1)]' 
                              : 'bg-white/5 border-white/5 hover:bg-white/10 transition-colors'
                          } ${isPast && !canWatchArchive ? 'opacity-50' : ''}`}
                        >
                          <div className="w-16 shrink-0 pt-0.5 text-right">
                            <div className={`text-sm font-bold ${isCurrent ? 'text-accent' : 'text-white/80'}`}>
                              {formatTime(prog.startTime)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 pr-8">
                            <h4 className={`text-sm font-semibold mb-1 ${isCurrent ? 'text-white' : 'text-white/90'}`}>
                              {decodeBase64(prog.title)}
                            </h4>
                            {prog.description && (
                              <p className="text-xs text-white/50 leading-relaxed">
                                {decodeBase64(prog.description)}
                              </p>
                            )}
                          </div>

                          {/* Кнопка Архіву */}
                          {canWatchArchive && (
                            <button
                              onClick={() => handlePlayArchive(prog)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-accent/20 hover:bg-accent text-accent hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                              title="Дивитися у записі"
                            >
                              <Play className="w-3.5 h-3.5 ml-0.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
