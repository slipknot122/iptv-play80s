import React from 'react'
import { useUIStore } from '../store/player.store'
import { useProvidersStore } from '../store/providers.store'
import { useContentStore } from '../store/content.store'
import { cn, formatRelativeTime } from '../lib/utils'
import {
  Tv,
  Film,
  Clapperboard,
  Heart,
  Settings,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Wifi
} from 'lucide-react'

// ============================================================
// Sidebar — Ліва навігаційна панель
// ============================================================

type Section = 'live' | 'movies' | 'series' | 'favorites' | 'settings' | 'providers'

interface NavItem {
  id: Section
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { id: 'live',      label: 'Прямий ефір',  icon: Tv },
  { id: 'movies',    label: 'Фільми',       icon: Film },
  { id: 'series',    label: 'Серіали',      icon: Clapperboard },
  { id: 'favorites', label: 'Обрані',       icon: Heart },
]

export function Sidebar(): React.ReactElement {
  const { activeSection, setActiveSection, isSidebarExpanded, toggleSidebar } = useUIStore()
  const { providers } = useProvidersStore()
  const { lastUpdated, refreshAll } = useContentStore()
  const { activeProviderId, setActiveProvider } = useUIStore()

  const activeProviders = providers.filter((p) => p.isActive)

  const handleRefresh = async () => {
    if (activeProviderId) {
      await refreshAll(activeProviderId)
    }
  }

  return (
    <aside className="flex flex-col h-full z-10 w-full">

      {/* Провайдер selector */}
      {activeProviders.length > 0 && (
        <div className="px-2 py-3 border-b border-neon-magenta/50 mb-2">
          <div className="relative">
            <select
              value={activeProviderId || ''}
              onChange={(e) => setActiveProvider(e.target.value)}
              className="w-full bg-[rgba(0,0,0,0.5)] border border-neon-cyan/50 rounded shadow-inner px-3 py-2 
                         text-white text-sm focus:outline-none focus:border-neon-cyan 
                         cursor-pointer appearance-none font-special uppercase"
            >
              {activeProviders.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0b001a]">{p.name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-neon-cyan">
              <ChevronRight className="w-4 h-4 transform rotate-90" />
            </div>
          </div>
        </div>
      )}

      {/* Навігація */}
      <nav className="flex-1 px-2 py-2 space-y-3 overflow-y-auto no-scrollbar">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                'neon-button flex items-center px-3 py-3 w-full',
                isActive && 'active'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm tracking-wide ml-3">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Нижня частина */}
      <div className="px-2 py-3 space-y-3 border-t border-neon-magenta/50 mt-2">
        {/* Кнопка оновлення */}
        <button
          onClick={handleRefresh}
          className="neon-button flex items-center px-3 py-3 w-full"
        >
          <RefreshCw className="w-4 h-4 flex-shrink-0" />
          <div className="flex flex-col items-start leading-tight ml-3">
            <span className="text-sm tracking-wide">Оновити</span>
            {lastUpdated && (
              <span className="text-neon-cyan opacity-80 text-[9px] font-special mt-1">
                {formatRelativeTime(lastUpdated)}
              </span>
            )}
          </div>
        </button>

        {/* Додати провайдера */}
        <button
          onClick={() => setActiveSection('providers')}
          className={cn(
            'neon-button flex items-center px-3 py-3 w-full',
            activeSection === 'providers' && 'active'
          )}
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm tracking-wide ml-3">Провайдери</span>
        </button>

        {/* Налаштування */}
        <button
          onClick={() => setActiveSection('settings')}
          className={cn(
            'neon-button flex items-center px-3 py-3 w-full',
            activeSection === 'settings' && 'active'
          )}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm tracking-wide ml-3">Налаштування</span>
        </button>
      </div>
    </aside>
  )
}
