import axios, { AxiosInstance } from 'axios'
import type {
  XtreamProvider,
  Channel,
  Category,
  Movie,
  MovieInfo,
  Series,
  SeriesInfo,
  VodCategory,
  SeriesCategory,
  EpgProgram
} from '../../renderer/src/lib/types'

// ============================================================
// Xtream Codes API сервіс
// Документація: http://dtv-bg.com/smarters/xtream-codes-api.pdf
// ============================================================

interface XtreamUserInfo {
  username: string
  password: string
  message: string
  auth: number
  status: string
  exp_date: string
  is_trial: string
  active_cons: string
  created_at: string
  max_connections: string
  allowed_output_formats: string[]
}

interface XtreamServerInfo {
  url: string
  port: string
  https_port: string
  server_protocol: string
  rtmp_port: string
  timezone: string
  timestamp_now: number
  time_now: string
  process: boolean
}

export interface XtreamAuthResponse {
  user_info: XtreamUserInfo
  server_info: XtreamServerInfo
}

export class XtreamService {
  private client: AxiosInstance
  private provider: XtreamProvider
  private baseUrl: string
  private apiUrl: string

  constructor(provider: XtreamProvider) {
    this.provider = provider
    // Очищаємо host від зайвих слешів в кінці
    const cleanHost = provider.host.replace(/\/+$/, '')
    const portStr = provider.port ? `:${provider.port}` : ''
    this.baseUrl = `${cleanHost}${portStr}`
    this.apiUrl = `${this.baseUrl}/player_api.php?username=${provider.username}&password=${provider.password}`

    console.log('[XtreamService] baseUrl:', this.baseUrl)
    console.log('[XtreamService] apiUrl:', this.apiUrl.replace(provider.password, '****'))

    this.client = axios.create({
      timeout: 60000,
      headers: {
        'User-Agent': 'IPTV-Player/1.0'
      }
    })
  }

  /** Перевірка авторизації та отримання даних акаунту */
  async authenticate(): Promise<XtreamAuthResponse> {
    const { data } = await this.client.get<XtreamAuthResponse>(this.apiUrl)
    if (!data.user_info || data.user_info.auth !== 1) {
      throw new Error('Невірний логін або пароль')
    }
    return data
  }

  // ----- Live TV -----

  /** Отримання категорій каналів */
  async getLiveCategories(): Promise<Category[]> {
    const { data } = await this.client.get<any>(`${this.apiUrl}&action=get_live_categories`)
    if (!data || !Array.isArray(data)) {
      console.warn('[XtreamService] getLiveCategories expected an array, got:', typeof data)
      return []
    }
    return data.map((cat: any) => ({
      id: String(cat.category_id),
      name: cat.category_name
    }))
  }

  /** Отримання каналів (всіх або за категорією) */
  async getLiveStreams(categoryId?: string): Promise<Channel[]> {
    const url = categoryId
      ? `${this.apiUrl}&action=get_live_streams&category_id=${categoryId}`
      : `${this.apiUrl}&action=get_live_streams`

    const { data } = await this.client.get<any>(url)

    if (!data || !Array.isArray(data)) {
      console.warn('[XtreamService] getLiveStreams expected an array, got:', typeof data)
      return []
    }

    return data.map((ch: any) => ({
      id: `${this.provider.id}_live_${ch.stream_id}`,
      providerId: this.provider.id,
      name: ch.name,
      logo: ch.stream_icon || undefined,
      categoryId: String(ch.category_id),
      streamUrl: this.buildLiveStreamUrl(ch.stream_id),
      epgId: ch.epg_channel_id || undefined,
      hasArchive: ch.tv_archive === 1,
      archiveDays: ch.tv_archive_duration ? Number(ch.tv_archive_duration) : 0
    }))
  }

  /** Побудова URL для live потоку */
  buildLiveStreamUrl(streamId: number, format: 'm3u8' | 'ts' = 'm3u8'): string {
    return `${this.baseUrl}/live/${this.provider.username}/${this.provider.password}/${streamId}.${format}`
  }

  /** Побудова URL для архівного (Catch-up) потоку */
  buildCatchupStreamUrl(streamId: number, startTimestampMs: number, durationMinutes: number, format: 'm3u8' | 'ts' = 'm3u8'): string {
    const d = new Date(startTimestampMs)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const startStr = `${year}-${month}-${day}:${hours}-${minutes}`
    
    return `${this.baseUrl}/timeshift/${this.provider.username}/${this.provider.password}/${durationMinutes}/${startStr}/${streamId}.${format}`
  }

  // ----- VOD -----

  /** Отримання категорій фільмів */
  async getVodCategories(): Promise<VodCategory[]> {
    const { data } = await this.client.get<any>(`${this.apiUrl}&action=get_vod_categories`)
    if (!data || !Array.isArray(data)) {
      console.warn('[XtreamService] getVodCategories expected an array, got:', typeof data)
      return []
    }
    return data.map((cat: any) => ({
      id: String(cat.category_id),
      name: cat.category_name,
      parentId: cat.parent_id ? String(cat.parent_id) : undefined
    }))
  }

  /** Отримання фільмів (всіх або за категорією) */
  async getVodStreams(categoryId?: string): Promise<Movie[]> {
    const url = categoryId
      ? `${this.apiUrl}&action=get_vod_streams&category_id=${categoryId}`
      : `${this.apiUrl}&action=get_vod_streams`

    const { data } = await this.client.get<any>(url)

    if (!data || !Array.isArray(data)) {
      console.warn('[XtreamService] getVodStreams expected an array, got:', typeof data)
      return []
    }

    return data.map((movie: any) => ({
      id: `${this.provider.id}_vod_${movie.stream_id}`,
      providerId: this.provider.id,
      name: movie.name,
      poster: movie.stream_icon || undefined,
      categoryId: String(movie.category_id),
      streamUrl: this.buildVodStreamUrl(movie.stream_id, movie.container_extension),
      rating: movie.rating ? String(movie.rating) : undefined
    }))
  }

  /** Отримання детальної інформації про фільм */
  async getVodInfo(streamId: string): Promise<MovieInfo> {
    const id = streamId.split('_vod_')[1]
    const { data } = await this.client.get<MovieInfo>(
      `${this.apiUrl}&action=get_vod_info&vod_id=${id}`
    )
    return data
  }

  /** Побудова URL для VOD потоку */
  buildVodStreamUrl(streamId: number, extension = 'mp4'): string {
    return `${this.baseUrl}/movie/${this.provider.username}/${this.provider.password}/${streamId}.${extension}`
  }

  // ----- Серіали -----

  /** Отримання категорій серіалів */
  async getSeriesCategories(): Promise<SeriesCategory[]> {
    const { data } = await this.client.get<any>(`${this.apiUrl}&action=get_series_categories`)
    if (!data || !Array.isArray(data)) {
      console.warn('[XtreamService] getSeriesCategories expected an array, got:', typeof data)
      return []
    }
    return data.map((cat: any) => ({
      id: String(cat.category_id),
      name: cat.category_name
    }))
  }

  /** Отримання серіалів (всіх або за категорією) */
  async getSeries(categoryId?: string): Promise<Series[]> {
    const url = categoryId
      ? `${this.apiUrl}&action=get_series&category_id=${categoryId}`
      : `${this.apiUrl}&action=get_series`

    const { data } = await this.client.get<any>(url)

    if (!data || !Array.isArray(data)) {
      console.warn('[XtreamService] getSeries expected an array, got:', typeof data)
      return []
    }

    return data.map((s: any) => ({
      id: `${this.provider.id}_series_${s.series_id}`,
      providerId: this.provider.id,
      name: s.name,
      cover: s.cover || undefined,
      backdrop: s.backdrop_path?.[0] || undefined,
      categoryId: String(s.category_id),
      plot: s.plot || undefined,
      cast: s.cast || undefined,
      director: s.director || undefined,
      genre: s.genre || undefined,
      releaseDate: s.releaseDate || undefined,
      rating: s.rating ? String(s.rating) : undefined
    }))
  }

  /** Отримання детальної інформації про серіал (сезони + епізоди) */
  async getSeriesInfo(seriesId: string): Promise<SeriesInfo> {
    const id = seriesId.split('_series_')[1]
    const { data } = await this.client.get<{
      info: SeriesInfo['info']
      episodes: Record<string, Array<{
        id: string
        episode_num: number
        title?: string
        container_extension: string
        info?: SeriesInfo['episodes'][string][0]['info']
      }>>
    }>(`${this.apiUrl}&action=get_series_info&series_id=${id}`)

    // Перетворення епізодів у правильний формат
    const episodes: SeriesInfo['episodes'] = {}
    for (const [season, eps] of Object.entries(data.episodes)) {
      episodes[season] = eps.map((ep) => ({
        id: ep.id,
        episodeNum: ep.episode_num,
        title: ep.title,
        containerExtension: ep.container_extension,
        streamUrl: this.buildSeriesStreamUrl(ep.id, ep.container_extension),
        info: ep.info
      }))
    }

    return { info: data.info, episodes }
  }

  /** Побудова URL для епізоду серіалу */
  buildSeriesStreamUrl(episodeId: string, extension = 'mkv'): string {
    return `${this.baseUrl}/series/${this.provider.username}/${this.provider.password}/${episodeId}.${extension}`
  }

  // ----- EPG -----

  /** Отримання короткого EPG (поточна + наступна) для каналу */
  async getShortEpg(streamId: string): Promise<EpgProgram[]> {
    const id = streamId.split('_live_')[1]
    const { data } = await this.client.get<{
      epg_listings: Array<{
        id: string
        epg_id: string
        title: string
        lang?: string
        start: string
        end: string
        description?: string
        channel_id: string
        start_timestamp: number
        stop_timestamp: number
      }>
    }>(`${this.apiUrl}&action=get_short_epg&stream_id=${id}&limit=2`)

    return (data.epg_listings || []).map((epg) => ({
      id: epg.id,
      channelId: epg.channel_id,
      title: decodeBase64(epg.title),
      description: epg.description ? decodeBase64(epg.description) : undefined,
      startTime: epg.start_timestamp * 1000,
      endTime: epg.stop_timestamp * 1000
    }))
  }

  /** Отримання повного EPG для каналу */
  async getSimpleDataTable(streamId: string): Promise<EpgProgram[]> {
    const id = streamId.split('_live_')[1]
    const { data } = await this.client.get<{
      epg_listings: Array<{
        id: string
        epg_id: string
        title: string
        description?: string
        channel_id: string
        start_timestamp: number
        stop_timestamp: number
      }>
    }>(`${this.apiUrl}&action=get_simple_data_table&stream_id=${id}`)

    return (data.epg_listings || []).map((epg) => ({
      id: epg.id,
      channelId: epg.channel_id,
      title: decodeBase64(epg.title),
      description: epg.description ? decodeBase64(epg.description) : undefined,
      startTime: epg.start_timestamp * 1000,
      endTime: epg.stop_timestamp * 1000
    }))
  }
}

/** Декодування base64 рядків у EPG */
function decodeBase64(str: string): string {
  try {
    return Buffer.from(str, 'base64').toString('utf-8')
  } catch {
    return str
  }
}
