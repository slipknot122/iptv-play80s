import React, { useMemo } from 'react'
import { useContentStore } from '../../store/content.store'
import { usePlayerStore, useUIStore } from '../../store/player.store'
import { Heart, Tv, Film, Clapperboard } from 'lucide-react'
import { FALLBACK_POSTER } from '../../lib/utils'
import { EmptyState } from '../../components/ui/LoadingStates'

// ============================================================
// FavoritesPage — Сторінка обраних каналів, фільмів, серіалів
// ============================================================

export function FavoritesPage(): React.ReactElement {
  const {
    channels,
    movies,
    seriesList,
    favoriteChannelIds,
    favoriteMovieIds,
    favoriteSeriesIds,
    toggleFavoriteChannel,
    toggleFavoriteMovie,
    toggleFavoriteSeries
  } = useContentStore()

  const { play } = usePlayerStore()
  const { setActiveSection } = useUIStore()

  const favoriteChannels = useMemo(
    () => channels.filter((ch) => favoriteChannelIds.includes(ch.id)),
    [channels, favoriteChannelIds]
  )

  const favoriteMovies = useMemo(
    () => movies.filter((m) => favoriteMovieIds.includes(m.id)),
    [movies, favoriteMovieIds]
  )

  const favoriteSeries = useMemo(
    () => seriesList.filter((s) => favoriteSeriesIds.includes(s.id)),
    [seriesList, favoriteSeriesIds]
  )

  const total = favoriteChannels.length + favoriteMovies.length + favoriteSeries.length

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <EmptyState
          icon={<Heart />}
          title="Обрані порожні"
          description="Натисніть на серце поряд із каналом, фільмом або серіалом"
        />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar p-4">
      {/* Канали */}
      {favoriteChannels.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Tv className="w-4 h-4 text-accent" />
            <h3 className="text-text-primary font-semibold text-sm">Канали</h3>
            <span className="badge badge-muted">{favoriteChannels.length}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {favoriteChannels.map((ch) => (
              <div
                key={ch.id}
                className="channel-card group p-3 cursor-pointer"
                onClick={() => play({
                  type: 'live', id: ch.id, name: ch.name,
                  url: ch.streamUrl, logo: ch.logo, providerId: ch.providerId
                })}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-bg-hover flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {ch.logo
                      ? <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      : <Tv className="w-4 h-4 text-text-muted" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-xs font-medium truncate">{ch.name}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavoriteChannel(ch.id) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Фільми */}
      {favoriteMovies.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Film className="w-4 h-4 text-accent" />
            <h3 className="text-text-primary font-semibold text-sm">Фільми</h3>
            <span className="badge badge-muted">{favoriteMovies.length}</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {favoriteMovies.map((movie) => (
              <div
                key={movie.id}
                className="media-card group cursor-pointer"
                onClick={() => play({
                  type: 'movie', id: movie.id, name: movie.name,
                  url: movie.streamUrl, poster: movie.poster, providerId: movie.providerId
                })}
              >
                <div className="aspect-[2/3] relative overflow-hidden">
                  <img
                    src={movie.poster || FALLBACK_POSTER}
                    alt={movie.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_POSTER }}
                  />
                  <button
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"
                    onClick={(e) => { e.stopPropagation(); toggleFavoriteMovie(movie.id) }}
                  >
                    <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                  </button>
                </div>
                <div className="p-1.5">
                  <p className="text-text-primary text-xs font-medium truncate">{movie.name}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Серіали */}
      {favoriteSeries.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clapperboard className="w-4 h-4 text-accent" />
            <h3 className="text-text-primary font-semibold text-sm">Серіали</h3>
            <span className="badge badge-muted">{favoriteSeries.length}</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {favoriteSeries.map((s) => (
              <div
                key={s.id}
                className="media-card group cursor-pointer"
                onClick={() => setActiveSection('series')}
              >
                <div className="aspect-[2/3] relative overflow-hidden">
                  <img
                    src={s.cover || FALLBACK_POSTER}
                    alt={s.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_POSTER }}
                  />
                  <button
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"
                    onClick={(e) => { e.stopPropagation(); toggleFavoriteSeries(s.id) }}
                  >
                    <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                  </button>
                </div>
                <div className="p-1.5">
                  <p className="text-text-primary text-xs font-medium truncate">{s.name}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
