import React from 'react'
import { cn } from '../../lib/utils'

// ============================================================
// UI: Toast Container (повідомлення)
// ============================================================

// Простий глобальний тост через кастомний store
interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

let toasts: Toast[] = []
let listeners: Array<(toasts: Toast[]) => void> = []

function notify(listeners: Array<(t: Toast[]) => void>, toasts: Toast[]): void {
  listeners.forEach((l) => l([...toasts]))
}

export const toast = {
  success: (message: string) => addToast(message, 'success'),
  error: (message: string) => addToast(message, 'error'),
  info: (message: string) => addToast(message, 'info')
}

function addToast(message: string, type: Toast['type']): void {
  const id = Date.now().toString()
  toasts = [...toasts, { id, message, type }]
  notify(listeners, toasts)
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    notify(listeners, toasts)
  }, 3500)
}

export function ToastContainer(): React.ReactElement {
  const [items, setItems] = React.useState<Toast[]>([])

  React.useEffect(() => {
    listeners.push(setItems)
    return () => {
      listeners = listeners.filter((l) => l !== setItems)
    }
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'glass px-4 py-3 rounded-lg shadow-xl text-sm font-medium animate-fade-in pointer-events-auto',
            t.type === 'success' && 'border-success/40 text-success',
            t.type === 'error' && 'border-error/40 text-error',
            t.type === 'info' && 'border-accent/40 text-accent'
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
