import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import axios from 'axios'
import type { M3UChannel, M3UPlaylist, Channel, Category } from '../../renderer/src/lib/types'

// ============================================================
// M3U Parser Service
// Парсинг M3U/M3U8 плейлистів (локальних і за URL)
// ============================================================

export class M3UService {
  // Кеш плейлистів (щоб не перезавантажувати при кожному запиті)
  private cache = new Map<string, { playlist: M3UPlaylist; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 хвилин

  /**
   * Завантаження та парсинг M3U за URL (з кешуванням)
   */
  async loadFromUrl(url: string): Promise<M3UPlaylist> {
    const cached = this.cache.get(url)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('[M3UService] Using cached playlist for:', url, '— channels:', cached.playlist.totalCount)
      return cached.playlist
    }

    console.log('[M3UService] Downloading playlist:', url)
    const { data } = await axios.get<string>(url, {
      timeout: 60000,
      responseType: 'text',
      headers: {
        'User-Agent': 'IPTV-Player/1.0'
      }
    })
    const playlist = this.parse(data)
    console.log('[M3UService] Parsed', playlist.totalCount, 'channels from URL')

    // Зберігаємо в кеш
    this.cache.set(url, { playlist, timestamp: Date.now() })
    return playlist
  }

  /**
   * Завантаження та парсинг M3U з локального файлу (з кешуванням)
   */
  async loadFromFile(filePath: string): Promise<M3UPlaylist> {
    const cached = this.cache.get(filePath)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.playlist
    }

    if (!existsSync(filePath)) {
      throw new Error(`Файл не знайдено: ${filePath}`)
    }
    const content = await readFile(filePath, 'utf-8')
    const playlist = this.parse(content)

    this.cache.set(filePath, { playlist, timestamp: Date.now() })
    return playlist
  }

  /**
   * Очистити кеш
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Парсинг M3U контенту
   * Підтримує стандартні теги: #EXTINF, tvg-id, tvg-name, tvg-logo, group-title
   */
  parse(content: string): M3UPlaylist {
    const channels: M3UChannel[] = []
    const lines = content.split(/\r?\n/)

    let currentChannel: Partial<M3UChannel> | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line.startsWith('#EXTINF')) {
        // Парсинг метаданих каналу
        currentChannel = this.parseExtInf(line)
      } else if (line && !line.startsWith('#') && currentChannel) {
        // URL потоку
        currentChannel.url = line
        if (currentChannel.name && currentChannel.url) {
          channels.push(currentChannel as M3UChannel)
        }
        currentChannel = null
      }
    }

    return {
      channels,
      totalCount: channels.length
    }
  }

  /**
   * Парсинг рядка #EXTINF
   * Приклад: #EXTINF:-1 tvg-id="UA1" tvg-name="Перший" tvg-logo="http://..." group-title="Україна",Перший
   */
  private parseExtInf(line: string): Partial<M3UChannel> {
    const channel: Partial<M3UChannel> = {}

    // Назва каналу (після останньої коми)
    const commaIndex = line.lastIndexOf(',')
    if (commaIndex !== -1) {
      channel.name = line.slice(commaIndex + 1).trim()
    }

    // tvg-id
    const tvgId = line.match(/tvg-id="([^"]*)"/i)
    if (tvgId?.[1]) channel.epgId = tvgId[1]

    // tvg-name (пріоритетна назва)
    const tvgName = line.match(/tvg-name="([^"]*)"/i)
    if (tvgName?.[1]) channel.name = tvgName[1]

    // tvg-logo
    const tvgLogo = line.match(/tvg-logo="([^"]*)"/i)
    if (tvgLogo?.[1]) channel.logo = tvgLogo[1]

    // group-title
    const groupTitle = line.match(/group-title="([^"]*)"/i)
    if (groupTitle?.[1]) channel.group = groupTitle[1]

    return channel
  }

  /**
   * Конвертація M3U каналів у формат Channel
   * Використовує стабільні ID на базі назви групи (без індексу)
   */
  convertToChannels(
    playlist: M3UPlaylist,
    providerId: string
  ): { channels: Channel[]; categories: Category[] } {
    const categoryMap = new Map<string, Category>()
    const channels: Channel[] = []

    playlist.channels.forEach((m3uChannel, index) => {
      const groupName = m3uChannel.group || 'Без категорії'

      // Стабільний ID категорії (без індексу!)
      const categoryId = `cat_${groupName.replace(/\s+/g, '_').toLowerCase()}`

      // Додаємо категорію якщо ще не додано
      if (!categoryMap.has(groupName)) {
        categoryMap.set(groupName, {
          id: categoryId,
          name: groupName,
          channelCount: 0
        })
      }

      const category = categoryMap.get(groupName)!
      category.channelCount = (category.channelCount || 0) + 1

      channels.push({
        id: `${providerId}_m3u_${index}`,
        providerId,
        name: m3uChannel.name || `Канал ${index + 1}`,
        logo: m3uChannel.logo,
        categoryId: category.id,
        categoryName: groupName,
        streamUrl: m3uChannel.url,
        epgId: m3uChannel.epgId
      })
    })

    return {
      channels,
      categories: Array.from(categoryMap.values())
    }
  }

  /**
   * Генерація M3U плейлиста (для експорту)
   */
  generate(channels: Channel[]): string {
    const lines = ['#EXTM3U']

    channels.forEach((ch) => {
      const extinf = [
        `#EXTINF:-1`,
        ch.epgId ? ` tvg-id="${ch.epgId}"` : '',
        ` tvg-name="${ch.name}"`,
        ch.logo ? ` tvg-logo="${ch.logo}"` : '',
        ch.categoryName ? ` group-title="${ch.categoryName}"` : '',
        `,${ch.name}`
      ].join('')

      lines.push(extinf, ch.streamUrl)
    })

    return lines.join('\n')
  }
}
