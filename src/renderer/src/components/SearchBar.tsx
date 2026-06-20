import React, { useState, useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { useUIStore } from '../store/player.store'
import { cn, debounce } from '../lib/utils'

// ============================================================
// SearchBar — Рядок пошуку
// ============================================================

interface SearchBarProps {
  placeholder?: string
  className?: string
}

export function SearchBar({ placeholder = 'Пошук...', className }: SearchBarProps): React.ReactElement {
  const { searchQuery, setSearchQuery } = useUIStore()
  const [localValue, setLocalValue] = useState(searchQuery)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced оновлення глобального пошуку
  const debouncedSearch = useCallback(
    debounce((value: unknown) => setSearchQuery(value as string), 300),
    []
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
    debouncedSearch(e.target.value)
  }

  const handleClear = () => {
    setLocalValue('')
    setSearchQuery('')
    inputRef.current?.focus()
  }

  return (
    <div className={cn('relative flex items-center', className)}>
      <Search className="absolute left-3 w-4 h-4 text-text-muted pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="input-base pl-9 pr-9 w-full text-sm"
        autoComplete="off"
        spellCheck={false}
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
