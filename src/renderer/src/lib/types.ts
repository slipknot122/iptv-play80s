// ============================================================
// IPTV Player — Основні TypeScript типи
// ============================================================

// ----- Провайдери -----

/** Тип джерела плейлиста */
export type ProviderType = 'xtream' | 'm3u'

/** Загальний інтерфейс провайдера */
export interface Provider {
  id: string
  name: string
  type: ProviderType
  isActive: boolean
  epgUrl?: string      // Кастомне посилання на EPG (XMLTV)
  lastUpdated?: number // timestamp
  createdAt: number
}

/** Провайдер Xtream Codes */
export interface XtreamProvider extends Provider {
  type: 'xtream'
  host: string
  port: number
  username: string
  password: string // зберігається зашифрованим
}

/** Провайдер M3U плейлиста */
export interface M3UProvider extends Provider {
  type: 'm3u'
  url?: string    // URL для онлайн M3U
  filePath?: string // шлях до локального файлу
}

// ----- Канали Live TV -----

/** Категорія каналів */
export interface Category {
  id: string
  name: string
  channelCount?: number
}

/** Live канал */
export interface Channel {
  id: string
  providerId: string
  name: string
  logo?: string
  categoryId?: string
  categoryName?: string
  streamUrl: string
  epgId?: string      // ID для зіставлення з EPG
  isFavorite?: boolean
  lastWatched?: number // timestamp
  // Дані EPG (завантажуються окремо)
  currentProgram?: EpgProgram
  nextProgram?: EpgProgram
  // Архів / Catch-up
  hasArchive?: boolean
  archiveDays?: number
  catchupType?: string
  catchupSource?: string
}

// ----- Фільми (VOD) -----

/** VOD категорія */
export interface VodCategory {
  id: string
  name: string
  parentId?: string
  movieCount?: number
}

/** Фільм */
export interface Movie {
  id: string
  providerId: string
  name: string
  poster?: string
  backdrop?: string
  categoryId?: string
  categoryName?: string
  streamUrl: string
  // Метадані
  year?: number
  rating?: string
  plot?: string
  genre?: string
  cast?: string
  director?: string
  duration?: number // в хвилинах
  releaseDate?: string
  isFavorite?: boolean
  // Resume
  watchPosition?: number  // секунди
  watchDuration?: number  // тривалість у секундах
}

/** Деталі VOD (з API) */
export interface MovieInfo {
  info: {
    name: string
    description?: string
    year?: string
    genre?: string
    cast?: string
    director?: string
    rating?: string
    rating_5based?: number
    releasedate?: string
    duration_secs?: number
    duration?: string
    cover_big?: string
    backdrop_path?: string[]
    movie_image?: string
    tmdb_id?: number
  }
  movie_data: {
    stream_id: number
    name: string
    added?: string
    category_id?: string
    container_extension?: string
    custom_sid?: string
    direct_source?: string
  }
}

// ----- Серіали -----

/** Категорія серіалів */
export interface SeriesCategory {
  id: string
  name: string
  seriesCount?: number
}

/** Серіал */
export interface Series {
  id: string
  providerId: string
  name: string
  cover?: string
  backdrop?: string
  categoryId?: string
  categoryName?: string
  // Метадані
  plot?: string
  cast?: string
  director?: string
  genre?: string
  releaseDate?: string
  rating?: string
  rating5?: number
  isFavorite?: boolean
  // Прогрес перегляду
  lastEpisodeWatched?: {
    seasonNum: number
    episodeId: string
    position: number
  }
}

/** Деталі серіалу */
export interface SeriesInfo {
  info: {
    name: string
    description?: string
    genre?: string
    cast?: string
    director?: string
    rating?: string
    rating_5based?: number
    releasedate?: string
    cover?: string
    backdrop_path?: string[]
  }
  episodes: Record<string, SeriesEpisode[]> // ключ — номер сезону
}

/** Епізод серіалу */
export interface SeriesEpisode {
  id: string
  episodeNum: number
  title?: string
  containerExtension: string
  streamUrl?: string
  info?: {
    duration?: string
    duration_secs?: number
    plot?: string
    rating?: string
    releasedate?: string
    movie_image?: string
  }
  // Resume
  watchPosition?: number
  watchDuration?: number
}

// ----- EPG (Телепрограма) -----

/** Передача в EPG */
export interface EpgProgram {
  id?: string
  channelId: string
  title: string
  description?: string
  startTime: number   // timestamp (ms)
  endTime: number     // timestamp (ms)
  category?: string
}

/** EPG даних для каналу */
export interface ChannelEpg {
  channelId: string
  programs: EpgProgram[]
}

// ----- Плеєр -----

/** Тип медіа в плеєрі */
export type MediaType = 'live' | 'movie' | 'series_episode' | 'catchup'

/** Елемент для відтворення */
export interface PlaybackItem {
  type: MediaType
  id: string
  name: string
  url: string
  logo?: string
  poster?: string
  providerId: string
  // Для серіалів
  seriesId?: string
  seasonNum?: number
  episodeNum?: number
  // Для resume
  startPosition?: number
  totalDuration?: number
}

/** Стан плеєра */
export interface PlayerState {
  isPlaying: boolean
  isPaused: boolean
  isLoading: boolean
  isFullscreen: boolean
  isPip: boolean
  volume: number      // 0-100
  isMuted: boolean
  currentTime: number // секунди
  duration: number    // секунди (для VOD)
  buffered: number    // секунди
  error?: string
  playerEngine: 'mpv' | 'hls'
}

// ----- Налаштування -----

/** Налаштування застосунку */
export interface AppSettings {
  // Плеєр
  preferredEngine: 'mpv' | 'hls'
  mpvPath?: string          // шлях до mpv.exe
  streamFormat: 'm3u8' | 'ts'
  // Оновлення
  autoRefreshInterval: number // хвилини (0 = вимкнено)
  // UI
  theme: 'dark'             // тільки темна тема
  language: 'uk'            // тільки українська
  // Останній перегляд
  lastPlayed?: {
    providerId: string
    channelId?: string
    movieId?: string
    seriesId?: string
  }
}

// ----- IPC Events -----

/** Запит до Xtream API */
export interface XtreamApiRequest {
  providerId: string
  action: string
  params?: Record<string, string>
}

/** Відповідь з Xtream API */
export interface XtreamApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/** M3U плейлист */
export interface M3UPlaylist {
  channels: M3UChannel[]
  totalCount: number
  catchupType?: string
  catchupDays?: number
  catchupSource?: string
}

/** Канал з M3U */
export interface M3UChannel {
  id?: string
  name: string
  logo?: string
  group?: string
  url: string
  epgId?: string
  catchupType?: string
  catchupDays?: number
  catchupSource?: string
}

// ----- Стан контенту (Zustand) -----

/** Статус завантаження */
export type LoadingStatus = 'idle' | 'loading' | 'success' | 'error'

/** Результат пошуку */
export interface SearchResult {
  channels: Channel[]
  movies: Movie[]
  series: Series[]
}
