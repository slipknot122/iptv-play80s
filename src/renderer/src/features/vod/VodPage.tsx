import React, { useEffect, useMemo, useState } from 'react'
import { useContentStore } from '../../store/content.store'
import { useUIStore, usePlayerStore } from '../../store/player.store'
import { SearchBar } from '../../components/SearchBar'
import { CategoryList } from '../live/CategoryList'
import { MovieSkeleton, ErrorMessage, EmptyState } from '../../components/ui/LoadingStates'
import { Film, Heart, Star, Play } from 'lucide-react'
import { cn, FALLBACK_POSTER } from '../../lib/utils'
import type { Movie, MovieInfo } from '../../lib/types'

// ============================================================
// VodPage — Сторінка фільмів
// ============================================================

export function VodPage(): React.ReactElement {
  const {
    vodCategories,
    movies,
    vodCategoriesStatus,
    moviesStatus,
    selectedVodCategory,
    loadVodCategories,
    loadMovies,
    setSelectedVodCategory,
    toggleFavoriteMovie
  } = useContentStore()

  const { activeProviderId, searchQuery } = useUIStore()
  const { play } = usePlayerStore()
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [movieInfo, setMovieInfo] = useState<MovieInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)

  useEffect(() => {
    if (!activeProviderId) return
    loadVodCategories(activeProviderId)
    loadMovies(activeProviderId)
  }, [activeProviderId])

  const handleCategorySelect = (id: string | null) => {
    setSelectedVodCategory(id)
    if (activeProviderId) loadMovies(activeProviderId, id || undefined)
  }

  const filteredMovies = useMemo(() => {
    if (!searchQuery) return movies
    const q = searchQuery.toLowerCase()
    return movies.filter((m) => m.name.toLowerCase().includes(q))
  }, [movies, searchQuery])

  const handleMovieClick = async (movie: Movie) => {
    setSelectedMovie(movie)
    setMovieInfo(null)

    if (activeProviderId) {
      setLoadingInfo(true)
      try {
        const result = await window.api.vod.info(activeProviderId, movie.id)
        if (result.success && result.data) setMovieInfo(result.data)
      } catch { /* ігноруємо */ }
      setLoadingInfo(false)
    }
  }

  const handlePlay = async (movie: Movie) => {
    const resume = await window.api.resume.get(movie.id)
    await play({
      type: 'movie',
      id: movie.id,
      name: movie.name,
      url: movie.streamUrl,
      poster: movie.poster,
      providerId: movie.providerId,
      startPosition: resume?.position || 0,
      totalDuration: resume?.duration
    })
    setSelectedMovie(null)
  }

  const isLoading = moviesStatus === 'loading'

  return (
    <div className="flex h-full">
      {/* Категорії */}
      <div className="w-48 flex-shrink-0 bg-bg-secondary border-r border-border/20 overflow-y-auto no-scrollbar">
        <CategoryList
          categories={vodCategories}
          selected={selectedVodCategory}
          onSelect={handleCategorySelect}
          isLoading={vodCategoriesStatus === 'loading'}
        />
      </div>

      {/* Фільми */}
      <div className="flex-1 flex flex-col overflow-hidden ml-2">
        <div className="flex items-center gap-3 px-4 py-3 border border-neon-cyan/50 bg-[rgba(0,243,255,0.05)] rounded-lg relative mb-2 shadow-[0_0_10px_rgba(0,243,255,0.2)]">
          <Film className="w-4 h-4 text-neon-cyan flex-shrink-0" />
          <h2 className="font-special tracking-widest uppercase text-white text-sm drop-shadow-[0_0_5px_#00f3ff]">Фільми</h2>
          {!isLoading && <span className="bg-neon-bg border border-neon-cyan px-2 rounded-sm text-xs text-neon-cyan ml-auto shadow-[0_0_5px_rgba(0,243,255,0.5)]">{filteredMovies.length}</span>}
        </div>
        <div className="px-4 py-2 border border-neon-magenta/50 bg-[rgba(255,0,255,0.05)] rounded-lg relative mb-2 shadow-[0_0_10px_rgba(255,0,255,0.2)]">
          <SearchBar placeholder="Пошук фільмів..." />
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {moviesStatus === 'error' ? (
            <ErrorMessage
              message="Не вдалося завантажити фільми"
              onRetry={() => activeProviderId && loadMovies(activeProviderId)}
            />
          ) : (
            <div className="p-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
              {isLoading
                ? Array.from({ length: 24 }).map((_, i) => <MovieSkeleton key={i} />)
                : filteredMovies.length === 0
                  ? <div className="col-span-full"><EmptyState icon={<Film />} title="Фільмів не знайдено" /></div>
                  : filteredMovies.map((movie) => (
                    <MovieCard
                      key={movie.id}
                      movie={movie}
                      onClick={() => handleMovieClick(movie)}
                      onFavorite={() => toggleFavoriteMovie(movie.id)}
                    />
                  ))
              }
            </div>
          )}
        </div>
      </div>

      {/* Деталі фільму (модальне вікно) */}
      {selectedMovie && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setSelectedMovie(null)}
        >
          <div
            className="glass rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-4">
              {/* Постер */}
              <img
                src={selectedMovie.poster || FALLBACK_POSTER}
                alt={selectedMovie.name}
                className="w-28 rounded-xl object-cover flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_POSTER }}
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-text-primary font-bold text-lg leading-tight">{selectedMovie.name}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {movieInfo?.info.year && <span className="badge badge-muted">{movieInfo.info.year}</span>}
                  {movieInfo?.info.genre && <span className="badge badge-muted">{movieInfo.info.genre}</span>}
                  {(selectedMovie.rating || movieInfo?.info.rating) && (
                    <span className="badge bg-warning/20 text-warning flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {movieInfo?.info.rating || selectedMovie.rating}
                    </span>
                  )}
                </div>
                {movieInfo?.info.description && (
                  <p className="text-text-secondary text-sm mt-3 leading-relaxed line-clamp-4">
                    {movieInfo.info.description}
                  </p>
                )}
                {loadingInfo && <div className="text-text-muted text-sm mt-2">Завантаження...</div>}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => handlePlay(selectedMovie)}
                className="btn-primary flex items-center gap-2 flex-1"
              >
                <Play className="w-4 h-4 fill-white" />
                Дивитись
              </button>
              <button
                onClick={() => setSelectedMovie(null)}
                className="btn-ghost flex-1 text-center"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ----- MovieCard -----

interface MovieCardProps {
  movie: Movie
  onClick: () => void
  onFavorite: () => void
}

function MovieCard({ movie, onClick, onFavorite }: MovieCardProps): React.ReactElement {
  return (
    <div className="media-card group" onClick={onClick} role="button" tabIndex={0}>
      {/* Постер */}
      <div className="aspect-[2/3] relative overflow-hidden">
        <img
          src={movie.poster || FALLBACK_POSTER}
          alt={movie.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_POSTER }}
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="w-10 h-10 text-white fill-white drop-shadow-lg" />
        </div>
        {/* Рейтинг */}
        {movie.rating && (
          <div className="absolute top-1.5 left-1.5 badge bg-black/70 text-yellow-400 flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5" />
            {movie.rating}
          </div>
        )}
        {/* Обрані */}
        <button
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center
                     opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
          onClick={(e) => { e.stopPropagation(); onFavorite() }}
        >
          <Heart className={cn('w-3 h-3', movie.isFavorite ? 'fill-red-500 text-red-500' : 'text-white')} />
        </button>
        {/* Resume badge */}
        {movie.watchPosition && movie.watchDuration && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/30">
            <div
              className="h-full bg-accent"
              style={{ width: `${(movie.watchPosition / movie.watchDuration) * 100}%` }}
            />
          </div>
        )}
      </div>
      {/* Назва */}
      <div className="p-1.5">
        <p className="text-text-primary text-xs font-medium leading-tight truncate">{movie.name}</p>
      </div>
    </div>
  )
}
