import React from 'react'
import { cn } from '../../lib/utils'

// ============================================================
// SkeletonLoader — Плейсхолдер завантаження
// ============================================================

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps): React.ReactElement {
  return <div className={cn('skeleton', className)} />
}

/** Скелетон для картки каналу */
export function ChannelSkeleton(): React.ReactElement {
  return (
    <div className="channel-card p-3 pointer-events-none">
      <Skeleton className="w-10 h-10 rounded-lg mb-2" />
      <Skeleton className="h-3 w-3/4 mb-1.5" />
      <Skeleton className="h-2 w-1/2 mb-2" />
      <Skeleton className="h-0.5 w-full" />
    </div>
  )
}

/** Скелетон для картки фільму */
export function MovieSkeleton(): React.ReactElement {
  return (
    <div className="media-card pointer-events-none">
      <Skeleton className="w-full aspect-[2/3]" />
      <div className="p-2">
        <Skeleton className="h-3 w-4/5 mb-1" />
        <Skeleton className="h-2 w-1/2" />
      </div>
    </div>
  )
}

/** Скелетон для рядка EPG */
export function EpgSkeleton(): React.ReactElement {
  return (
    <div className="flex items-center gap-3 p-3 border-b border-border/10 pointer-events-none">
      <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-3 w-2/3 mb-2" />
        <Skeleton className="h-2 w-1/2" />
      </div>
    </div>
  )
}

/** Loading spinner */
export function LoadingSpinner({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div
        className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin"
      />
    </div>
  )
}

/** Повідомлення про помилку */
export function ErrorMessage({
  message,
  onRetry
}: {
  message: string
  onRetry?: () => void
}): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
        <span className="text-error text-xl">!</span>
      </div>
      <div className="text-center">
        <p className="text-text-secondary mb-1">Помилка завантаження</p>
        <p className="text-text-muted text-sm">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary text-sm">
          Спробувати знову
        </button>
      )}
    </div>
  )
}

/** Порожній стан */
export function EmptyState({
  icon,
  title,
  description
}: {
  icon?: React.ReactNode
  title: string
  description?: string
}): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-bg-hover flex items-center justify-center text-text-muted text-3xl">
          {icon}
        </div>
      )}
      <div className="text-center">
        <p className="text-text-secondary font-medium">{title}</p>
        {description && <p className="text-text-muted text-sm mt-1">{description}</p>}
      </div>
    </div>
  )
}
