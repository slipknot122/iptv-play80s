import React from 'react'
import { useUIStore } from '../../store/player.store'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export function EpgProgressToast(): React.ReactElement | null {
  const { epgSyncStatus, setEpgSyncStatus } = useUIStore()

  if (!epgSyncStatus) return null

  const isDone = epgSyncStatus.status === 'Готово'
  const isError = epgSyncStatus.status.toLowerCase().includes('помилка')
  const percent = epgSyncStatus.percent ?? 0

  // Автоматичне приховування після завершення
  if (isDone || isError) {
    setTimeout(() => {
      setEpgSyncStatus(null)
    }, 3000)
  }

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className={cn(
        "bg-surface/95 backdrop-blur-md border rounded-xl p-4 shadow-xl max-w-sm w-72 flex flex-col gap-3",
        isError ? "border-red-500/30" : isDone ? "border-green-500/30" : "border-white/10"
      )}>
        <div className="flex items-center gap-3">
          {isDone ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : isError ? (
            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-red-500 text-xs font-bold">!</span>
            </div>
          ) : (
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
          )}
          <span className="text-sm font-medium text-text-primary flex-1 truncate">
            {epgSyncStatus.status}
          </span>
          {!isDone && !isError && percent > 0 && (
            <span className="text-xs font-medium text-text-muted">
              {percent}%
            </span>
          )}
        </div>
        
        {/* Прогрес бар */}
        {!isDone && !isError && (
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
