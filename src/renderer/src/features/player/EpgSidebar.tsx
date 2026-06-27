import React, { useEffect, useState, useMemo } from 'react'
import { X, Play, Clock } from 'lucide-react'
import { useContentStore } from '../../store/content.store'
import { usePlayerStore } from '../../store/player.store'
import type { EpgProgram } from '../../lib/types'
import { cn, decodeBase64, formatTime } from '../../lib/utils'

interface EpgSidebarProps {
  channelId: string
  providerId: string
  onClose: () => void
}

export function EpgSidebar({ channelId, providerId, onClose }: EpgSidebarProps): React.ReactElement {
  const [programs, setPrograms] = useState<EpgProgram[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { channels } = useContentStore()
  const { play } = usePlayerStore()

  const channel = channels.find(c => c.id === channelId)

  useEffect(() => {
    let isMounted = true
    const fetchEpg = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await window.api.epg.full(providerId, channelId, channel?.epgId)
        if (isMounted) {
          if (result.success && result.data) {
            setPrograms(result.data)
          } else {
            setError('Не вдалося завантажити програму')
          }
        }
      } catch (e) {
        if (isMounted) setError('Помилка завантаження')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    fetchEpg()
    return () => { isMounted = false }
  }, [channelId, providerId])

  // Групування програм по днях
  const groupedPrograms = useMemo(() => {
    const groups: Record<string, EpgProgram[]> = {}
    programs.forEach(p => {
      const ms = p.startTime > 9999999999 ? p.startTime : p.startTime * 1000
      const date = new Date(ms)
      // Форматуємо дату як "Сьогодні, 18 Червня" або "17 Червня"
      const dateStr = date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })
      const isToday = new Date().toDateString() === date.toDateString()
      const key = isToday ? `Сьогодні, ${dateStr}` : dateStr
      
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    })
    return groups
  }, [programs])

  const now = Date.now()

  const handlePlayArchive = async (program: EpgProgram) => {
    if (!channelId || !providerId) return
    const startMs = program.startTime > 9999999999 ? program.startTime : program.startTime * 1000
    const endMs = program.endTime > 9999999999 ? program.endTime : program.endTime * 1000
    const durationMinutes = Math.round((endMs - startMs) / 60000)
    
    try {
      const res = await window.api.live.catchupUrl(providerId, channelId, startMs, durationMinutes)
      if (res.success && res.data) {
        await play({
          type: 'catchup',
          id: `${channelId}_archive_${program.startTime}`,
          name: decodeBase64(program.title),
          url: res.data,
          logo: channel.logo,
          providerId,
          totalDuration: durationMinutes * 60
        })
      }
    } catch (e) {
      console.error('Failed to play archive', e)
    }
  }

  return (
    <div className="absolute top-0 right-0 bottom-0 w-80 bg-bg-primary/95 backdrop-blur-md border-l border-white/10 flex flex-col pointer-events-auto z-50">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent" />
          Телепрограма
        </h3>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-white/50 text-center mt-10 text-sm">{error}</div>
        ) : programs.length === 0 ? (
          <div className="text-white/50 text-center mt-10 text-sm">Немає даних телепрограми</div>
        ) : (
          Object.entries(groupedPrograms).map(([day, dayPrograms]) => (
            <div key={day}>
              <h4 className="text-white/60 text-xs font-semibold mb-3 uppercase tracking-wider">{day}</h4>
              <div className="flex flex-col gap-3">
                {dayPrograms.map(p => {
                  const startMs = p.startTime > 9999999999 ? p.startTime : p.startTime * 1000
                  const endMs = p.endTime > 9999999999 ? p.endTime : p.endTime * 1000
                  const isPast = endMs < now
                  const isCurrent = startMs <= now && endMs >= now
                  
                  // Чи можна дивитися архів (минуле, але в межах archiveDays)
                  const canWatchArchive = isPast && channel?.hasArchive && 
                    (now - endMs <= (channel.archiveDays || 0) * 24 * 60 * 60 * 1000)

                  return (
                    <div 
                      key={p.startTime} 
                      className={cn(
                        "flex gap-3 p-2.5 rounded-lg transition-colors group relative",
                        isCurrent ? "bg-white/10 border border-white/10" : "hover:bg-white/5",
                        !isPast && !isCurrent ? "opacity-70" : ""
                      )}
                    >
                      {/* Час */}
                      <div className="text-sm font-mono text-accent w-12 flex-shrink-0 pt-0.5">
                        {formatTime(startMs)}
                      </div>
                      
                      {/* Інфо */}
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium leading-tight mb-1" title={decodeBase64(p.title)}>{decodeBase64(p.title)}</div>
                        {p.description && (
                          <div className="text-white/50 text-xs line-clamp-2 leading-snug" title={decodeBase64(p.description)}>{decodeBase64(p.description)}</div>
                        )}
                      </div>

                      {/* Кнопка Архіву */}
                      {canWatchArchive && (
                        <button
                          onClick={() => handlePlayArchive(p)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-accent/20 hover:bg-accent text-accent hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
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
          ))
        )}
      </div>
    </div>
  )
}
