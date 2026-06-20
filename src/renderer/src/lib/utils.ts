import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { uk } from 'date-fns/locale'

/** Об'єднання класів Tailwind */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Форматування часу EPG (HH:MM) */
export function formatTime(timestamp: number): string {
  return format(new Date(timestamp), 'HH:mm')
}

/** Форматування дати (ДД.ММ.РРРР) */
export function formatDate(timestamp: number): string {
  return format(new Date(timestamp), 'dd.MM.yyyy')
}

/** Відносний час (напр. "5 хвилин тому") */
export function formatRelativeTime(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: uk })
}

/** Відсоток прогресу EPG */
export function getEpgProgress(startTime: number, endTime: number): number {
  const now = Date.now()
  if (now < startTime) return 0
  if (now > endTime) return 100
  return Math.round(((now - startTime) / (endTime - startTime)) * 100)
}

/** Форматування тривалості (секунди -> HH:MM:SS або MM:SS) */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Генерація унікального ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/** Безпечна обрізка довгого тексту */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return `${str.slice(0, maxLength)}...`
}

/** Отримання ініціалів для аватара */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('')
}

/** Перевірка чи URL є валідним */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/** Debounce функція */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/** Форматування числа (напр. 1500 -> 1.5K) */
export function formatCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

/** Перевірка чи передача зараз іде */
export function isCurrentlyAiring(startTime: number, endTime: number): boolean {
  const now = Date.now()
  return now >= startTime && now <= endTime
}

/** Fallback зображення для логотипів */
export const FALLBACK_LOGO = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI0IiBmaWxsPSIjMjUyODM4Ii8+PHBhdGggZD0iTTEyIDE2TDIwIDI0TDI4IDE2IiBzdHJva2U9IiM2MzY2RjEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+`

/** Fallback постер для фільмів */
export const FALLBACK_POSTER = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCIgdmlld0JveD0iMCAwIDEyMCAxNjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEyMCIgaGVpZ2h0PSIxNjAiIHJ4PSI4IiBmaWxsPSIjMjUyODM4Ii8+PHBhdGggZD0iTTQ1IDcwTDYwIDg1TDc1IDcwIiBzdHJva2U9IiM2MzY2RjEiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+`
