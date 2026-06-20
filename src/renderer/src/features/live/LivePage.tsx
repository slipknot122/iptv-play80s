import React, { useEffect, useMemo } from 'react'
import { useContentStore } from '../../store/content.store'
import { useUIStore } from '../../store/player.store'
import { SearchBar } from '../../components/SearchBar'
import { ChannelCard } from './ChannelCard'
import { CategoryList } from './CategoryList'
import { ChannelSkeleton, ErrorMessage, EmptyState } from '../../components/ui/LoadingStates'
import { Tv } from 'lucide-react'

// ============================================================
// LivePage — Сторінка прямого ефіру
// ============================================================

export function LivePage(): React.ReactElement {
  const {
    liveCategories,
    channels,
    liveCategoriesStatus,
    channelsStatus,
    selectedLiveCategory,
    loadLiveCategories,
    loadChannels,
    setSelectedLiveCategory
  } = useContentStore()

  const { activeProviderId, searchQuery } = useUIStore()

  // Завантаження при зміні провайдера
  useEffect(() => {
    if (!activeProviderId) return
    loadLiveCategories(activeProviderId)
    loadChannels(activeProviderId)
  }, [activeProviderId])

  // Зміна категорії
  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedLiveCategory(categoryId)
    if (activeProviderId) {
      loadChannels(activeProviderId, categoryId || undefined)
    }
  }

  // Фільтрація каналів
  const filteredChannels = useMemo(() => {
    if (!searchQuery) return channels
    const q = searchQuery.toLowerCase()
    return channels.filter((ch) => ch.name.toLowerCase().includes(q))
  }, [channels, searchQuery])

  const isLoading = channelsStatus === 'loading'
  const isError = channelsStatus === 'error'

  return (
    <div className="flex h-full">
      {/* Список категорій */}
      <div className="w-48 flex-shrink-0 bg-bg-secondary border-r border-border/20 overflow-y-auto no-scrollbar">
        <CategoryList
          categories={liveCategories}
          selected={selectedLiveCategory}
          onSelect={handleCategorySelect}
          isLoading={liveCategoriesStatus === 'loading'}
        />
      </div>

      {/* Список каналів */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20">
          <Tv className="w-4 h-4 text-accent flex-shrink-0" />
          <h2 className="font-semibold text-text-primary text-sm">
            {selectedLiveCategory
              ? liveCategories.find((c) => c.id === selectedLiveCategory)?.name || 'Канали'
              : 'Всі канали'}
          </h2>
          {!isLoading && (
            <span className="badge badge-muted ml-auto">{filteredChannels.length}</span>
          )}
        </div>

        {/* Пошук */}
        <div className="px-4 py-2 border-b border-border/10">
          <SearchBar placeholder="Пошук каналів..." />
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {isError ? (
            <ErrorMessage
              message="Не вдалося завантажити канали"
              onRetry={() => activeProviderId && loadChannels(activeProviderId, selectedLiveCategory || undefined)}
            />
          ) : (
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
              {isLoading
                ? Array.from({ length: 18 }).map((_, i) => <ChannelSkeleton key={i} />)
                : filteredChannels.length === 0
                  ? (
                    <div className="col-span-full">
                      <EmptyState
                        icon={<Tv />}
                        title="Канали не знайдено"
                        description={searchQuery ? `За запитом "${searchQuery}"` : 'Виберіть провайдера або категорію'}
                      />
                    </div>
                  )
                  : filteredChannels.map((channel) => (
                    <ChannelCard key={channel.id} channel={channel} />
                  ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
