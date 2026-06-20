import axios from 'axios'
import * as zlib from 'zlib'
import { XMLParser } from 'fast-xml-parser'
import type { EpgProgram } from '../../renderer/src/lib/types'

export class XmltvService {
  // Кеш розкладів (URL -> Кеш)
  private cache = new Map<string, { data: Record<string, EpgProgram[]>; timestamp: number }>()
  private readonly CACHE_TTL = 12 * 60 * 60 * 1000 // 12 годин
  private pendingRequests = new Map<string, Promise<Record<string, EpgProgram[]>>>()

  /**
   * Завантаження та парсинг XMLTV
   * Повертає мапу: tvg-id -> список програм
   */
  async loadEpg(url: string, onProgress?: (status: string, percent?: number) => void): Promise<Record<string, EpgProgram[]>> {
    const cached = this.cache.get(url)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('[XmltvService] Using cached EPG for:', url)
      return cached.data
    }

    if (this.pendingRequests.has(url)) {
      return this.pendingRequests.get(url)!
    }

    const promise = this._fetchAndParse(url, onProgress)
    this.pendingRequests.set(url, promise)

    try {
      return await promise
    } finally {
      this.pendingRequests.delete(url)
    }
  }

  private async _fetchAndParse(url: string, onProgress?: (status: string, percent?: number) => void): Promise<Record<string, EpgProgram[]>> {
    console.log('[XmltvService] Downloading XMLTV:', url)
    try {
      onProgress?.('Завантаження EPG...', 0)
      
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            onProgress?.('Завантаження EPG...', percent)
          } else {
            onProgress?.('Завантаження EPG (розмір невідомий)...')
          }
        }
      })

      let xmlContent = ''

      onProgress?.('Розпакування EPG...', 100)
      // Перевіряємо чи файл стиснутий (gz)
      if (url.endsWith('.gz') || String(response.headers['content-type']).includes('gzip')) {
        console.log('[XmltvService] Unzipping EPG data...')
        const unzipped = zlib.gunzipSync(response.data as Buffer)
        xmlContent = unzipped.toString('utf-8')
      } else {
        xmlContent = Buffer.from(response.data).toString('utf-8')
      }

      onProgress?.('Обробка розкладу (це може зайняти хвилину)...')
      console.log('[XmltvService] Parsing XMLTV data...')
      // Віддаємо час Node.js для відмальовки прогресу перед важким парсингом
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const parsedData = this.parseXmltv(xmlContent)
      
      this.cache.set(url, { data: parsedData, timestamp: Date.now() })
      console.log(`[XmltvService] Loaded EPG for ${Object.keys(parsedData).length} channels.`)
      
      onProgress?.('Готово', 100)
      return parsedData
    } catch (error) {
      console.error('[XmltvService] Failed to load XMLTV:', error)
      onProgress?.('Помилка завантаження EPG')
      throw new Error('Не вдалося завантажити EPG')
    }
  }

  private parseXmltv(xmlContent: string): Record<string, EpgProgram[]> {
    const decodeEntities = (text: string) => {
      if (typeof text !== 'string') return text
      return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      processEntities: false, // Запобігає помилці "Entity expansion limit exceeded"
      isArray: (name) => name === 'programme' || name === 'channel',
      tagValueProcessor: (_tagName, tagValue) => decodeEntities(tagValue),
      attributeValueProcessor: (_attrName, attrValue) => decodeEntities(attrValue)
    })

    const parsed = parser.parse(xmlContent)
    const tv = parsed.tv || parsed.TV

    if (!tv || !tv.programme) {
      console.warn('[XmltvService] No <programme> tags found in XMLTV')
      return {}
    }

    const programmes = tv.programme
    const result: Record<string, EpgProgram[]> = {}

    for (const prog of programmes) {
      const channelId = prog['@_channel']
      if (!channelId) continue

      const start = this.parseXmltvDate(prog['@_start'])
      const stop = this.parseXmltvDate(prog['@_stop'])

      if (!start || !stop) continue

      const getText = (node: any): string => {
        if (!node) return ''
        if (typeof node === 'string') return node
        if (typeof node === 'number') return node.toString()
        if (Array.isArray(node)) return getText(node[0])
        if (typeof node === 'object') {
          if (node['#text'] !== undefined && node['#text'] !== null) return String(node['#text'])
          return ''
        }
        return String(node)
      }

      const title = getText(prog.title)
      const desc = getText(prog.desc)

      if (!result[channelId]) {
        result[channelId] = []
      }

      result[channelId].push({
        id: `${channelId}_${start}`,
        channelId: channelId,
        title: title || 'Без назви',
        description: desc || '',
        startTime: start,
        endTime: stop
      })
    }

    // Сортуємо програми по часу
    for (const channelId in result) {
      result[channelId].sort((a, b) => a.startTime - b.startTime)
    }

    return result
  }

  /**
   * Парсинг формату дати XMLTV: "20231018090000 +0300"
   */
  private parseXmltvDate(dateStr: string): number | null {
    if (!dateStr || dateStr.length < 14) return null
    
    try {
      const year = parseInt(dateStr.substring(0, 4))
      const month = parseInt(dateStr.substring(4, 6)) - 1
      const day = parseInt(dateStr.substring(6, 8))
      const hour = parseInt(dateStr.substring(8, 10))
      const min = parseInt(dateStr.substring(10, 12))
      const sec = parseInt(dateStr.substring(12, 14))

      let offsetStr = dateStr.substring(15).trim()
      if (offsetStr.startsWith('+') || offsetStr.startsWith('-')) {
        // Якщо є timezone offset, створюємо рядок формату ISO
        const isoStr = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}T${dateStr.substring(8,10)}:${dateStr.substring(10,12)}:${dateStr.substring(12,14)}${offsetStr.substring(0,3)}:${offsetStr.substring(3,5)}`
        return new Date(isoStr).getTime()
      } else {
        // Якщо немає, вважаємо локальним або UTC (повернемо локальний)
        return new Date(year, month, day, hour, min, sec).getTime()
      }
    } catch (e) {
      return null
    }
  }
}
