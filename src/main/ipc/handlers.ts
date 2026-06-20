import { ipcMain, dialog, safeStorage, BrowserWindow } from 'electron'
import { store } from '../store'
import { XtreamService } from '../services/xtream.service'
import { M3UService } from '../services/m3u.service'
import { XmltvService } from '../services/xmltv.service'
import { mpvService } from '../services/mpv.service'
import type { XtreamProvider, M3UProvider, AppSettings } from '../../renderer/src/lib/types'
import { generateId } from './utils'

// ============================================================
// Реєстрація всіх IPC handlers
// ============================================================

const m3uService = new M3UService()
const xmltvService = new XmltvService()

// Кеш Xtream сервісів (один на провайдера)
const xtreamServiceCache = new Map<string, XtreamService>()

function getXtreamService(providerId: string): XtreamService {
  if (!xtreamServiceCache.has(providerId)) {
    const providers = store.get('providers')
    const provider = providers.find(
      (p) => p.id === providerId && p.type === 'xtream'
    ) as XtreamProvider | undefined

    if (!provider) throw new Error(`Провайдер не знайдено: ${providerId}`)

    // Розшифровуємо пароль
    const password = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(provider.password, 'base64'))
      : provider.password

    xtreamServiceCache.set(
      providerId,
      new XtreamService({ ...provider, password })
    )
  }
  return xtreamServiceCache.get(providerId)!
}

let lastMpvRect = {x: 0, y: 0, width: 0, height: 0}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {

  ipcMain.handle('window:close', () => mainWindow.close())

  // ========== ПРОВАЙДЕРИ ==========

  /** Отримати список провайдерів */
  ipcMain.handle('providers:list', () => {
    const providers = store.get('providers')
    // Маскуємо паролі у відповіді
    return providers.map((p) => ({
      ...p,
      password: p.type === 'xtream' ? '••••••••' : undefined
    }))
  })

  /** Додати Xtream провайдера */
  ipcMain.handle('providers:add-xtream', async (_e, data: Omit<XtreamProvider, 'id' | 'createdAt'>) => {
    try {
      // Шифруємо пароль
      const encryptedPassword = safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(data.password).toString('base64')
        : data.password

      const provider: XtreamProvider = {
        ...data,
        id: generateId(),
        password: encryptedPassword,
        createdAt: Date.now(),
        isActive: true
      }

      // Перевірка підключення
      const service = new XtreamService({ ...provider, password: data.password })
      await service.authenticate()

      const providers = store.get('providers')
      store.set('providers', [...providers, provider])

      xtreamServiceCache.delete(provider.id)
      return { success: true, provider: { ...provider, password: '••••••••' } }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  /** Додати M3U провайдера */
  ipcMain.handle('providers:add-m3u', async (_e, data: Omit<M3UProvider, 'id' | 'createdAt'>) => {
    try {
      const provider: M3UProvider = {
        ...data,
        id: generateId(),
        createdAt: Date.now(),
        isActive: true
      }

      // Перевірка завантаження плейлиста
      if (data.url) {
        await m3uService.loadFromUrl(data.url)
      } else if (data.filePath) {
        await m3uService.loadFromFile(data.filePath)
      } else {
        return { success: false, error: 'Вкажіть URL або шлях до файлу' }
      }

      const providers = store.get('providers')
      store.set('providers', [...providers, provider])
      return { success: true, provider }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  /** Видалити провайдера */
  ipcMain.handle('providers:delete', (_e, providerId: string) => {
    const providers = store.get('providers').filter((p) => p.id !== providerId)
    store.set('providers', providers)
    xtreamServiceCache.delete(providerId)
    return { success: true }
  })

  /** Оновити провайдера */
  ipcMain.handle('providers:update', (_e, providerId: string, updates: Partial<XtreamProvider | M3UProvider>) => {
    const providers = store.get('providers').map((p) =>
      p.id === providerId ? { ...p, ...updates } : p
    )
    store.set('providers', providers)
    xtreamServiceCache.delete(providerId)
    return { success: true }
  })

  /** Вибір M3U файлу через діалог */
  ipcMain.handle('providers:browse-m3u', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Вибір M3U плейлиста',
      filters: [
        { name: 'M3U Playlist', extensions: ['m3u', 'm3u8'] },
        { name: 'Всі файли', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  // ========== LIVE TV ==========

  /** Отримати категорії каналів */
  ipcMain.handle('live:categories', async (_e, providerId: string) => {
    try {
      const provider = store.get('providers').find((p) => p.id === providerId)
      if (!provider) throw new Error('Провайдер не знайдено')

      if (provider.type === 'xtream') {
        const service = getXtreamService(providerId)
        return { success: true, data: await service.getLiveCategories() }
      } else {
        // M3U — категорії з групп
        const m3u = provider as M3UProvider
        const playlist = m3u.url
          ? await m3uService.loadFromUrl(m3u.url)
          : await m3uService.loadFromFile(m3u.filePath!)
        const { categories } = m3uService.convertToChannels(playlist, providerId)
        return { success: true, data: categories }
      }
    } catch (err) {
      console.error('[IPC live:categories] Error:', (err as Error).message)
      return { success: false, error: (err as Error).message }
    }
  })

  /** Отримати канали */
  ipcMain.handle('live:channels', async (_e, providerId: string, categoryId?: string) => {
    try {
      const provider = store.get('providers').find((p) => p.id === providerId)
      if (!provider) throw new Error('Провайдер не знайдено')

      if (provider.type === 'xtream') {
        const service = getXtreamService(providerId)
        const channels = await service.getLiveStreams(categoryId)
        return { success: true, data: channels }
      } else {
        const m3u = provider as M3UProvider
        const playlist = m3u.url
          ? await m3uService.loadFromUrl(m3u.url)
          : await m3uService.loadFromFile(m3u.filePath!)
        const { channels } = m3uService.convertToChannels(playlist, providerId)
        const filtered = categoryId
          ? channels.filter((ch) => ch.categoryId === categoryId)
          : channels
        return { success: true, data: filtered }
      }
    } catch (err) {
      console.error('[IPC live:channels] Error:', (err as Error).message)
      return { success: false, error: (err as Error).message }
    }
  })

  /** Побудувати URL для архіву (catch-up) */
  ipcMain.handle('live:catchup-url', async (_e, providerId: string, channelId: string, startTimeMs: number, durationMinutes: number) => {
    try {
      const provider = store.get('providers').find((p) => p.id === providerId)
      if (!provider) throw new Error('Провайдер не знайдено')

      if (provider.type === 'xtream') {
        const service = getXtreamService(providerId)
        const streamId = Number(channelId.split('_live_')[1])
        const url = service.buildCatchupStreamUrl(streamId, startTimeMs, durationMinutes)
        return { success: true, data: url }
      } else if (provider.type === 'm3u') {
        const m3u = provider as M3UProvider
        const playlist = m3u.url 
          ? await m3uService.loadFromUrl(m3u.url)
          : await m3uService.loadFromFile(m3u.filePath!)
        
        const { channels } = m3uService.convertToChannels(playlist, providerId)
        const channel = channels.find(c => c.id === channelId)
        
        if (!channel) throw new Error('Канал не знайдено в M3U')
        if (!channel.hasArchive) throw new Error('Канал не підтримує архів')

        let url = channel.catchupSource || channel.streamUrl
        const startSec = Math.floor(startTimeMs / 1000)
        const endSec = startSec + durationMinutes * 60

        // Замінимо плейсхолдери у catchupSource, якщо є
        if (url.includes('{utc}')) url = url.replace(/{utc}/g, startSec.toString())
        if (url.includes('{utcend}')) url = url.replace(/{utcend}/g, endSec.toString())

        // Якщо catchupSource не було, або він був без плейсхолдерів і тип 'shift' / 'append'
        if (!channel.catchupSource && (channel.catchupType === 'shift' || channel.catchupType === 'append' || channel.catchupType === 'default')) {
          const sep = url.includes('?') ? '&' : '?'
          url += `${sep}utc=${startSec}&lutc=${endSec}`
        } else if (channel.catchupType === 'flussonic') {
          // Flussonic: /channel/index.m3u8 -> /channel-{start}-{duration}.m3u8
          const durationSec = durationMinutes * 60
          url = url.replace(/\.m3u8/, `-${startSec}-${durationSec}.m3u8`)
        }

        return { success: true, data: url }
      }
      return { success: false, error: 'Unknown provider type' }
    } catch (err) {
      console.error('[IPC live:catchup-url] Error:', (err as Error).message)
      return { success: false, error: (err as Error).message }
    }
  })

// ========== EPG ==========

  /** Отримати короткий EPG для каналу */
  ipcMain.handle('epg:short', async (_e, providerId: string, channelId: string, epgId?: string) => {
    try {
      const provider = store.get('providers').find((p) => p.id === providerId)
      if (!provider) return { success: true, data: [] }

      // Якщо вказано кастомний EPG
      if (provider.epgUrl && epgId) {
        const fullEpg = await xmltvService.loadEpg(provider.epgUrl, (status, percent) => {
          _e.sender.send('epg:progress', { status, percent })
        })
        const channelEpg = fullEpg[epgId] || []
        const now = Date.now()
        // Знаходимо поточну і наступну
        const currentIdx = channelEpg.findIndex(p => p.startTime <= now && p.endTime >= now)
        if (currentIdx !== -1) {
          return { success: true, data: channelEpg.slice(currentIdx, currentIdx + 2) }
        }
        // Якщо поточної немає, повертаємо перші дві майбутні
        const future = channelEpg.filter(p => p.startTime > now).slice(0, 2)
        return { success: true, data: future }
      }

      if (provider.type === 'xtream') {
        const service = getXtreamService(providerId)
        const data = await service.getShortEpg(channelId)
        return { success: true, data }
      }

      return { success: true, data: [] }
    } catch (err) {
      return { success: false, error: (err as Error).message, data: [] }
    }
  })

  /** Отримати повний EPG для каналу */
  ipcMain.handle('epg:full', async (_e, providerId: string, channelId: string, epgId?: string) => {
    try {
      const provider = store.get('providers').find((p) => p.id === providerId)
      if (!provider) return { success: true, data: [] }

      // Якщо вказано кастомний EPG
      if (provider.epgUrl && epgId) {
        const fullEpg = await xmltvService.loadEpg(provider.epgUrl, (status, percent) => {
          _e.sender.send('epg:progress', { status, percent })
        })
        return { success: true, data: fullEpg[epgId] || [] }
      }

      if (provider.type === 'xtream') {
        const service = getXtreamService(providerId)
        const data = await service.getSimpleDataTable(channelId)
        return { success: true, data }
      }

      return { success: true, data: [] }
    } catch (err) {
      return { success: false, error: (err as Error).message, data: [] }
    }
  })

  // ========== VOD ==========

  /** Отримати категорії фільмів */
  ipcMain.handle('vod:categories', async (_e, providerId: string) => {
    try {
      const provider = store.get('providers').find((p) => p.id === providerId)
      if (!provider) throw new Error('Провайдер не знайдено')
      if (provider.type === 'm3u') {
        // M3U плейлисти не мають VOD розділу
        return { success: true, data: [] }
      }
      const service = getXtreamService(providerId)
      return { success: true, data: await service.getVodCategories() }
    } catch (err) {
      console.error('[IPC vod:categories] Error:', (err as Error).message)
      return { success: false, error: (err as Error).message }
    }
  })

  /** Отримати фільми */
  ipcMain.handle('vod:movies', async (_e, providerId: string, categoryId?: string) => {
    try {
      const provider = store.get('providers').find((p) => p.id === providerId)
      if (!provider) throw new Error('Провайдер не знайдено')
      if (provider.type === 'm3u') {
        return { success: true, data: [] }
      }
      const service = getXtreamService(providerId)
      const movies = await service.getVodStreams(categoryId)
      return { success: true, data: movies }
    } catch (err) {
      console.error('[IPC vod:movies] Error:', (err as Error).message)
      return { success: false, error: (err as Error).message }
    }
  })

  /** Отримати деталі фільму */
  ipcMain.handle('vod:info', async (_e, providerId: string, movieId: string) => {
    try {
      const service = getXtreamService(providerId)
      const data = await service.getVodInfo(movieId)
      return { success: true, data }
    } catch (err) {
      console.error('[IPC vod:info] Error:', (err as Error).message)
      return { success: false, error: (err as Error).message }
    }
  })

  // ========== СЕРІАЛИ ==========

  /** Отримати категорії серіалів */
  ipcMain.handle('series:categories', async (_e, providerId: string) => {
    try {
      const provider = store.get('providers').find((p) => p.id === providerId)
      if (!provider) throw new Error('Провайдер не знайдено')
      if (provider.type === 'm3u') {
        return { success: true, data: [] }
      }
      const service = getXtreamService(providerId)
      return { success: true, data: await service.getSeriesCategories() }
    } catch (err) {
      console.error('[IPC series:categories] Error:', (err as Error).message)
      return { success: false, error: (err as Error).message }
    }
  })

  /** Отримати серіали */
  ipcMain.handle('series:list', async (_e, providerId: string, categoryId?: string) => {
    try {
      const provider = store.get('providers').find((p) => p.id === providerId)
      if (!provider) throw new Error('Провайдер не знайдено')
      if (provider.type === 'm3u') {
        return { success: true, data: [] }
      }
      const service = getXtreamService(providerId)
      const series = await service.getSeries(categoryId)
      return { success: true, data: series }
    } catch (err) {
      console.error('[IPC series:list] Error:', (err as Error).message)
      return { success: false, error: (err as Error).message }
    }
  })

  /** Отримати деталі серіалу */
  ipcMain.handle('series:info', async (_e, providerId: string, seriesId: string) => {
    try {
      const service = getXtreamService(providerId)
      const data = await service.getSeriesInfo(seriesId)
      return { success: true, data }
    } catch (err) {
      console.error('[IPC series:info] Error:', (err as Error).message)
      return { success: false, error: (err as Error).message }
    }
  })

  // ========== MPV ПЛЕЄР ==========

  /** Перевірка наявності mpv */
  ipcMain.handle('mpv:check', async () => {
    const settings = store.get('settings')
    return mpvService.findMpv(settings.mpvPath)
  })

  /** Запуск відтворення через mpv */
  ipcMain.handle('mpv:play', async (_e, url: string) => {
    try {
      const bounds = mainWindow.getContentBounds()
      const targetX = Math.round(bounds.x + lastMpvRect.x)
      const targetY = Math.round(bounds.y + lastMpvRect.y)
      const targetW = Math.round(lastMpvRect.width)
      const targetH = Math.round(lastMpvRect.height)

      const geometry = `${targetW}x${targetH}+${targetX}+${targetY}`

      await mpvService.start(url, geometry)

      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // Continuously update MPV window bounds when mainWindow moves or resizes
  const syncMpvBounds = () => {
    if (!mpvService.isConnected || lastMpvRect.width === 0) return
    const bounds = mainWindow.getContentBounds()
    const targetX = Math.round(bounds.x + lastMpvRect.x)
    const targetY = Math.round(bounds.y + lastMpvRect.y)
    const targetW = Math.round(lastMpvRect.width)
    const targetH = Math.round(lastMpvRect.height)
    mpvService.updateGeometry(`${targetW}x${targetH}+${targetX}+${targetY}`)
  }

  mainWindow.on('move', syncMpvBounds)
  mainWindow.on('resize', syncMpvBounds)
  mainWindow.on('minimize', () => mpvService.setMinimized(true))
  mainWindow.on('restore', () => mpvService.setMinimized(false))

  ipcMain.handle('mpv:geometry', (_e, rect: {x: number, y: number, width: number, height: number}) => {
    if (
      lastMpvRect.x === rect.x &&
      lastMpvRect.y === rect.y &&
      lastMpvRect.width === rect.width &&
      lastMpvRect.height === rect.height
    ) {
      return
    }
    lastMpvRect = rect
    
    if (mpvService.isConnected) {
      const bounds = mainWindow.getContentBounds()
      const targetX = Math.round(bounds.x + lastMpvRect.x)
      const targetY = Math.round(bounds.y + lastMpvRect.y)
      const targetW = Math.round(lastMpvRect.width)
      const targetH = Math.round(lastMpvRect.height)
      mpvService.updateGeometry(`${targetW}x${targetH}+${targetX}+${targetY}`)
    }
  })

  /** Завантажити новий URL в mpv */
  ipcMain.handle('mpv:load', async (_e, url: string) => {
    try {
      await mpvService.loadFile(url)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  /** Пауза */
  ipcMain.handle('mpv:pause', async (_e, paused: boolean) => {
    await mpvService.setPause(paused)
    return { success: true }
  })

  /** Перемотування */
  ipcMain.handle('mpv:seek', async (_e, position: number) => {
    await mpvService.seek(position)
    return { success: true }
  })

  /** Гучність */
  ipcMain.handle('mpv:volume', async (_e, volume: number) => {
    await mpvService.setVolume(volume)
    return { success: true }
  })

  /** Стан mpv */
  ipcMain.handle('mpv:state', async () => {
    try {
      const [position, duration, volume, paused] = await Promise.all([
        mpvService.getPosition(),
        mpvService.getDuration(),
        mpvService.getVolume(),
        mpvService.isPaused()
      ])
      return { success: true, data: { position, duration, volume, paused, isRunning: mpvService.isRunning } }
    } catch {
      return { success: true, data: { position: 0, duration: 0, volume: 100, paused: false, isRunning: false } }
    }
  })

  /** Зупинка mpv */
  ipcMain.handle('mpv:stop', async () => {
    await mpvService.stop()
    return { success: true }
  })

  // ========== НАЛАШТУВАННЯ ==========

  /** Отримати налаштування */
  ipcMain.handle('settings:get', () => store.get('settings'))

  /** Зберегти налаштування */
  ipcMain.handle('settings:set', (_e, settings: Partial<AppSettings>) => {
    const current = store.get('settings')
    store.set('settings', { ...current, ...settings })
    return { success: true }
  })

  // ========== ОБРАНІ ==========

  /** Отримати обрані */
  ipcMain.handle('favorites:get', () => store.get('favorites'))

  /** Додати/видалити з обраних */
  ipcMain.handle('favorites:toggle', (_e, type: 'channels' | 'movies' | 'series', id: string) => {
    const favorites = store.get('favorites')
    const list = favorites[type]
    const index = list.indexOf(id)
    if (index === -1) {
      list.push(id)
    } else {
      list.splice(index, 1)
    }
    store.set('favorites', { ...favorites, [type]: list })
    return { success: true, isFavorite: index === -1 }
  })

  // ========== RESUME POSITIONS ==========

  /** Зберегти позицію перегляду */
  ipcMain.handle('resume:save', (_e, id: string, position: number, duration: number) => {
    const positions = store.get('resumePositions')
    positions[id] = { position, duration, updatedAt: Date.now() }
    store.set('resumePositions', positions)
    return { success: true }
  })

  /** Отримати позицію перегляду */
  ipcMain.handle('resume:get', (_e, id: string) => {
    const positions = store.get('resumePositions')
    return positions[id] || null
  })

  // ========== LAST PLAYED ==========

  ipcMain.handle('last-played:set', (_e, data: { type: string; providerId: string; itemId: string }) => {
    store.set('lastPlayed', data)
    return { success: true }
  })

  ipcMain.handle('last-played:get', () => store.get('lastPlayed'))

  // ========== MPV EVENTS -> RENDERER ==========

  // Пробрасовуємо події mpv до renderer процесу
  mpvService.on('play', () => mainWindow.webContents.send('mpv:event', { type: 'play' }))
  mpvService.on('pause', () => mainWindow.webContents.send('mpv:event', { type: 'pause' }))
  mpvService.on('ended', () => mainWindow.webContents.send('mpv:event', { type: 'ended' }))
  mpvService.on('error', (err) => mainWindow.webContents.send('mpv:event', { type: 'error', error: err.message }))
  mpvService.on('exit', () => {
    mainWindow.webContents.send('mpv:event', { type: 'exit' })
  })
}
