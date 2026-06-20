import React, { useEffect, useMemo, useState } from 'react'
import { useContentStore } from '../../store/content.store'
import { useUIStore, usePlayerStore } from '../../store/player.store'
import { SearchBar } from '../../components/SearchBar'
import { CategoryList } from '../live/CategoryList'
import { MovieSkeleton, ErrorMessage, EmptyState, LoadingSpinner } from '../../components/ui/LoadingStates'
import { Clapperboard, ChevronRight, Play, Heart, Star } from 'lucide-react'
import { cn, FALLBACK_POSTER } from '../../lib/utils'
import type { Series, SeriesInfo, XtreamProvider } from '../../lib/types'

// ============================================================
// SeriesPage — Сторінка серіалів
// ============================================================

type View = 'list' | 'detail'

export function SeriesPage(): React.ReactElement {
  const {
    seriesCategories,
    seriesList,
    seriesCategoriesStatus,
    seriesListStatus,
    selectedSeriesCategory,
    loadSeriesCategories,
    loadSeriesList,
    setSelectedSeriesCategory,
    toggleFavoriteSeries
  } = useContentStore()

  const { activeProviderId, searchQuery } = useUIStore()
  const { play } = usePlayerStore()

  const [view, setView] = useState<View>('list')
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null)
  const [seriesInfo, setSeriesInfo] = useState<SeriesInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null)

  useEffect(() => {
    if (!activeProviderId) return
    loadSeriesCategories(activeProviderId)
    loadSeriesList(activeProviderId)
  }, [activeProviderId])

  const handleCategorySelect = (id: string | null) => {
    setSelectedSeriesCategory(id)
    if (activeProviderId) loadSeriesList(activeProviderId, id || undefined)
  }

  const filteredSeries = useMemo(() => {
    if (!searchQuery) return seriesList
    const q = searchQuery.toLowerCase()
    return seriesList.filter((s) => s.name.toLowerCase().includes(q))
  }, [seriesList, searchQuery])

  const handleSeriesClick = async (series: Series) => {
    setSelectedSeries(series)
    setSeriesInfo(null)
    setSelectedSeason(null)
    setView('detail')

    if (activeProviderId) {
      setLoadingInfo(true)
      try {
        const result = await window.api.series.info(activeProviderId, series.id)
        if (result.success && result.data) {
          setSeriesInfo(result.data)
          const seasons = Object.keys(result.data.episodes)
          if (seasons.length > 0) setSelectedSeason(seasons[0])
        }
      } catch { /* ігноруємо */ }
      setLoadingInfo(false)
    }
  }

  const handlePlayEpisode = async (episodeId: string, extension: string) => {
    if (!selectedSeries || !activeProviderId) return
    const providers = await window.api.providers.list()
    const provider = providers.find((p: { id: string }) => p.id === activeProviderId)
    if (!provider || provider.type !== 'xtream') return
    const xtream = provider as XtreamProvider

    const url = `${xtream.host}:${xtream.port}/series/${xtream.username}/${xtream.password}/${episodeId}.${extension}`
    const season = selectedSeason ? parseInt(selectedSeason) : 1
    const episode = seriesInfo?.episodes[selectedSeason || '1']?.find((e) => e.id === episodeId)

    const resume = await window.api.resume.get(episodeId)

    await play({
      type: 'series_episode',
      id: episodeId,
      name: selectedSeries.name,
      url,
      poster: selectedSeries.cover,
      providerId: selectedSeries.providerId,
      seriesId: selectedSeries.id,
      seasonNum: season,
      episodeNum: episode?.episodeNum,
      startPosition: resume?.position || 0
    })
  }

  const isLoading = seriesListStatus === 'loading'
  const seasons = seriesInfo ? Object.keys(seriesInfo.episodes).sort((a, b) => Number(a) - Number(b)) : []
  const currentEpisodes = selectedSeason && seriesInfo ? seriesInfo.episodes[selectedSeason] || [] : []

  return (
    <div className="flex h-full">
      {/* Категорії */}
      <div className="w-48 flex-shrink-0 bg-bg-secondary border-r border-border/20 overflow-y-auto no-scrollbar">
        <CategoryList
          categories={seriesCategories}
          selected={selectedSeriesCategory}
          onSelect={handleCategorySelect}
          isLoading={seriesCategoriesStatus === 'loading'}
        />
      </div>

      {/* Основний контент */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20">
          <Clapperboard className="w-4 h-4 text-accent flex-shrink-0" />
          {view === 'detail' && selectedSeries ? (
            <>
              <button
                onClick={() => setView('list')}
                className="text-text-muted hover:text-text-primary text-sm transition-colors"
              >
                Серіали
              </button>
              <ChevronRight className="w-3 h-3 text-text-muted" />
              <h2 className="font-semibold text-text-primary text-sm truncate">{selectedSeries.name}</h2>
            </>
          ) : (
            <>
              <h2 className="font-semibold text-text-primary text-sm">Серіали</h2>
              {!isLoading && <span className="badge badge-muted ml-auto">{filteredSeries.length}</span>}
            </>
          )}
        </div>

        {view === 'list' ? (
          <>
            <div className="px-4 py-2 border-b border-border/10">
              <SearchBar placeholder="Пошук серіалів..." />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {seriesListStatus === 'error' ? (
                <ErrorMessage message="Не вдалося завантажити серіали" onRetry={() => activeProviderId && loadSeriesList(activeProviderId)} />
              ) : (
                <div className="p-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
                  {isLoading
                    ? Array.from({ length: 24 }).map((_, i) => <MovieSkeleton key={i} />)
                    : filteredSeries.length === 0
                      ? <div className="col-span-full"><EmptyState icon={<Clapperboard />} title="Серіали не знайдено" /></div>
                      : filteredSeries.map((s) => (
                        <SeriesCard
                          key={s.id}
                          series={s}
                          onClick={() => handleSeriesClick(s)}
                          onFavorite={() => toggleFavoriteSeries(s.id)}
                        />
                      ))
                  }
                </div>
              )}
            </div>
          </>
        ) : (
          /* Деталі серіалу */
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {loadingInfo ? (
              <LoadingSpinner className="mt-16" />
            ) : seriesInfo ? (
              <div className="p-4">
                {/* Інфо про серіал */}
                <div className="flex gap-4 mb-6">
                  <img
                    src={selectedSeries?.cover || FALLBACK_POSTER}
                    alt={selectedSeries?.name}
                    className="w-32 rounded-xl object-cover flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_POSTER }}
                  />
                  <div>
                    <h3 className="text-text-primary font-bold text-xl">{selectedSeries?.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {seriesInfo.info.genre && <span className="badge badge-muted">{seriesInfo.info.genre}</span>}
                      {seriesInfo.info.rating && (
                        <span className="badge bg-warning/20 text-warning flex items-center gap-1">
                          <Star className="w-3 h-3" />{seriesInfo.info.rating}
                        </span>
                      )}
                    </div>
                    {seriesInfo.info.description && (
                      <p className="text-text-secondary text-sm mt-3 leading-relaxed line-clamp-3">
                        {seriesInfo.info.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Вибір сезону */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  {seasons.map((season) => (
                    <button
                      key={season}
                      onClick={() => setSelectedSeason(season)}
                      className={cn('category-pill', selectedSeason === season && 'active')}
                    >
                      Сезон {season}
                    </button>
                  ))}
                </div>

                {/* Список епізодів */}
                <div className="space-y-2">
                  {currentEpisodes.map((episode) => (
                    <div
                      key={episode.id}
                      className="card-hover flex items-center gap-3 p-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-accent text-xs font-bold">{episode.episodeNum}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-text-primary text-sm font-medium truncate">
                          {episode.title || `Епізод ${episode.episodeNum}`}
                        </p>
                        {episode.info?.duration && (
                          <p className="text-text-muted text-xs">{episode.info.duration}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handlePlayEpisode(episode.id, episode.containerExtension)}
                        className="btn-icon hover:bg-accent/20 hover:text-accent flex-shrink-0"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

// ----- SeriesCard -----

interface SeriesCardProps {
  series: Series
  onClick: () => void
  onFavorite: () => void
}

function SeriesCard({ series, onClick, onFavorite }: SeriesCardProps): React.ReactElement {
  return (
    <div className="media-card group" onClick={onClick} role="button" tabIndex={0}>
      <div className="aspect-[2/3] relative overflow-hidden">
        <img
          src={series.cover || FALLBACK_POSTER}
          alt={series.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_POSTER }}
        />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ChevronRight className="w-10 h-10 text-white drop-shadow-lg" />
        </div>
        <button
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center
                     opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
          onClick={(e) => { e.stopPropagation(); onFavorite() }}
        >
          <Heart className={cn('w-3 h-3', series.isFavorite ? 'fill-red-500 text-red-500' : 'text-white')} />
        </button>
      </div>
      <div className="p-1.5">
        <p className="text-text-primary text-xs font-medium leading-tight truncate">{series.name}</p>
      </div>
    </div>
  )
}
