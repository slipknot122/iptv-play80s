import React from 'react'
import type { Category } from '../../lib/types'
import { cn } from '../../lib/utils'
import { Skeleton } from '../../components/ui/LoadingStates'
import { List } from 'lucide-react'

// ============================================================
// CategoryList — Список категорій у сайдбарі
// ============================================================

interface CategoryListProps {
  categories: Category[]
  selected: string | null
  onSelect: (id: string | null) => void
  isLoading?: boolean
}

export function CategoryList({
  categories,
  selected,
  onSelect,
  isLoading
}: CategoryListProps): React.ReactElement {
  return (
    <div className="p-2">
      {/* Заголовок */}
      <div className="flex items-center gap-2 px-2 py-4 mb-2 border-b border-neon-magenta/30">
        <List className="w-4 h-4 text-neon-magenta" />
        <span className="text-neon-cyan text-xs font-special uppercase tracking-widest font-bold drop-shadow-[0_0_5px_#00f3ff]">
          Категорії
        </span>
      </div>

      {isLoading ? (
        Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full mb-1 rounded-lg" />
        ))
      ) : (
        <>
          {/* "Всі" пункт */}
          <button
            onClick={() => onSelect(null)}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg text-sm font-special transition-all duration-300 mb-1 border border-transparent',
              !selected
                ? 'text-white font-bold bg-[rgba(255,0,255,0.2)] border-neon-magenta shadow-[0_0_10px_rgba(255,0,255,0.4)] text-shadow-[0_0_5px_#ff00ff]'
                : 'text-neon-cyan opacity-80 hover:text-white hover:bg-[rgba(0,243,255,0.1)] hover:border-neon-cyan hover:shadow-[0_0_10px_rgba(0,243,255,0.2)]'
            )}
          >
            Всі канали
          </button>

          {/* Категорії */}
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm font-special transition-all duration-300 mb-1 border border-transparent flex justify-between items-center',
                selected === cat.id
                  ? 'text-white font-bold bg-[rgba(255,0,255,0.2)] border-neon-magenta shadow-[0_0_10px_rgba(255,0,255,0.4)] text-shadow-[0_0_5px_#ff00ff]'
                  : 'text-neon-cyan opacity-80 hover:text-white hover:bg-[rgba(0,243,255,0.1)] hover:border-neon-cyan hover:shadow-[0_0_10px_rgba(0,243,255,0.2)]'
              )}
            >
              <span className="truncate">{cat.name}</span>
              {cat.channelCount !== undefined && (
                <span className="text-[9px] text-white opacity-60 ml-2">{cat.channelCount}</span>
              )}
            </button>
          ))}
        </>
      )}
    </div>
  )
}
