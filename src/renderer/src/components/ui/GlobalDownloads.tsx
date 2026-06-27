import React, { useEffect, useRef } from 'react'
import { useDownloadStore } from '../../store/download.store'
import { X, HardDriveDownload, Check } from 'lucide-react'

export const GlobalDownloads: React.FC = () => {
  const { downloads, cancelDownload, removeDownload } = useDownloadStore()
  const autoDismissTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  
  const activeDownloads = Object.values(downloads)

  // Auto-dismiss завершених завантажень через 5 секунд
  useEffect(() => {
    for (const dl of activeDownloads) {
      if (dl.progress >= 100 && !autoDismissTimers.current[dl.url]) {
        autoDismissTimers.current[dl.url] = setTimeout(() => {
          removeDownload(dl.url)
          delete autoDismissTimers.current[dl.url]
        }, 5000)
      }
    }
    
    // Очищаємо таймери для видалених завантажень
    return () => {
      for (const [url, timer] of Object.entries(autoDismissTimers.current)) {
        if (!downloads[url]) {
          clearTimeout(timer)
          delete autoDismissTimers.current[url]
        }
      }
    }
  }, [activeDownloads, removeDownload, downloads])
  
  if (activeDownloads.length === 0) return null

  return (
    <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {activeDownloads.map((dl) => {
        const isFinished = dl.progress >= 100
        const isIndeterminate = dl.progress < 0
        
        return (
          <div key={dl.url} className="glass p-3 rounded-lg border border-border/20 shadow-lg neon-box">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-text-primary">
                {isFinished 
                  ? <Check size={16} className="text-green-500 shrink-0" />
                  : <HardDriveDownload size={16} className="text-neon-cyan shrink-0" />
                }
                <span className="truncate">{isFinished ? 'Завантажено!' : 'Завантаження файлу'}</span>
              </div>
              <button 
                onClick={() => {
                  if (isFinished) {
                    // Скасувати auto-dismiss і видалити одразу
                    if (autoDismissTimers.current[dl.url]) {
                      clearTimeout(autoDismissTimers.current[dl.url])
                      delete autoDismissTimers.current[dl.url]
                    }
                    removeDownload(dl.url)
                  } else {
                    cancelDownload(dl.url)
                  }
                }}
                className="text-text-secondary hover:text-neon-red transition-colors"
                title={isFinished ? "Закрити" : "Відмінити"}
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden relative">
              <div 
                className={`h-full transition-all duration-300 ${isFinished ? 'bg-green-500' : 'bg-neon-cyan shadow-[0_0_10px_#00f3ff]'}`}
                style={{ width: isIndeterminate ? '100%' : `${Math.max(0, Math.min(100, dl.progress))}%` }}
              />
              {isIndeterminate && (
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              )}
            </div>
            
            <div className="flex justify-between mt-1 text-[10px] text-text-secondary font-mono">
              <span>{isFinished ? 'Завершено' : (isIndeterminate ? 'Завантаження...' : `${dl.progress.toFixed(1)}%`)}</span>
              {!isIndeterminate && dl.total > 0 ? (
                <span>{(dl.downloaded / 1024 / 1024).toFixed(1)} / {(dl.total / 1024 / 1024).toFixed(1)} MB</span>
              ) : (
                !isIndeterminate && dl.downloaded > 0 && (
                  <span>{(dl.downloaded / 1024 / 1024).toFixed(1)} MB</span>
                )
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
