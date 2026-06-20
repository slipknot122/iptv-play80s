import { spawn, ChildProcess, exec } from 'child_process'
import { existsSync, appendFileSync } from 'fs'
import { join } from 'path'
import { EventEmitter } from 'events'
import * as net from 'net'
import { app } from 'electron'

function logDebug(msg: string) {
  try {
    const logPath = join(app.getPath('userData'), 'iptv_debug.log')
    appendFileSync(logPath, new Date().toISOString() + ' - ' + msg + '\n')
  } catch (e) {}
}

// ============================================================
// MPV Player Service
// Керування mpv через named pipe IPC (Windows)
// ============================================================

let CURRENT_PIPE_NAME = '\\\\.\\pipe\\iptv-mpv-ipc'

// Можливі шляхи до mpv.exe на Windows
const MPV_SEARCH_PATHS = [
  join(process.cwd(), 'resources', 'mpv', 'mpv.exe'),
  join(__dirname, '..', '..', 'resources', 'mpv', 'mpv.exe'),
  'C:\\Program Files\\mpv\\mpv.exe',
  'C:\\Program Files (x86)\\mpv\\mpv.exe',
  join(process.env.LOCALAPPDATA || '', 'mpv', 'mpv.exe'),
  join(process.env.APPDATA || '', 'mpv', 'mpv.exe')
]

export interface MpvStatus {
  isAvailable: boolean
  mpvPath?: string
  version?: string
}

export interface MpvPlaybackState {
  isPlaying: boolean
  isPaused: boolean
  position: number     // секунди
  duration: number     // секунди
  volume: number       // 0-100
  isMuted: boolean
}

export class MpvService extends EventEmitter {
  private mpvProcess: ChildProcess | null = null
  private mpvPath: string | null = null
  private ipcClient: net.Socket | null = null
  private commandId = 0
  private pendingCommands = new Map<number, { resolve: (result: unknown) => void, reject: (err: Error) => void }>()
  private isConnected = false

  /**
   * Знаходження mpv.exe у системі
   */
  async findMpv(customPath?: string): Promise<MpvStatus> {
    // Спочатку перевіряємо кастомний шлях
    if (customPath && existsSync(customPath)) {
      this.mpvPath = customPath
      return { isAvailable: true, mpvPath: customPath }
    }

    // Шукаємо у стандартних місцях
    for (const path of MPV_SEARCH_PATHS) {
      if (existsSync(path)) {
        this.mpvPath = path
        return { isAvailable: true, mpvPath: path }
      }
    }

    // Перевіряємо чи mpv є в PATH
    return new Promise((resolve) => {
      exec('where mpv', (err, stdout) => {
        if (!err && stdout) {
          const firstPath = stdout.split('\n')[0].trim()
          this.mpvPath = firstPath
          resolve({ isAvailable: true, mpvPath: firstPath })
        } else {
          resolve({ isAvailable: false })
        }
      })
    })
  }

  /**
   * Запуск mpv процесу
   */
  async start(url: string, wid?: bigint): Promise<void> {
    if (!this.mpvPath) {
      throw new Error('MPV не знайдено. Встановіть mpv або вкажіть шлях у налаштуваннях.')
    }

    // Зупиняємо попередній процес якщо є
    await this.stop()

    CURRENT_PIPE_NAME = `\\\\.\\pipe\\iptv_player_mpv_ipc_${Date.now()}`

    const args: string[] = [
      url,
      '--no-terminal',
      '--no-border',
      '--no-osc',                      // вимикаємо стандартний OSD
      '--no-input-default-bindings',   // вимикаємо стандартні прив'язки клавіш
      `--input-ipc-server=${CURRENT_PIPE_NAME}`,
      '--idle=yes',
      '--volume=100',
      '--keep-open=yes',
      '--hwdec=auto',
      '--network-timeout=60',
      '--stream-lavf-o=timeout=60000000',
      '--cache=yes',
      '--demuxer-max-bytes=500M',
      '--demuxer-max-back-bytes=100M',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--http-header-fields=X-Forwarded-For: 46.118.22.33,X-Real-IP: 46.118.22.33'
    ]

    // Embedding у Electron вікно через HWND
    if (wid) {
      args.push(`--wid=${wid.toString()}`)
    }

    this.mpvProcess = spawn(this.mpvPath, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.mpvProcess.stdout?.on('data', (data: Buffer) => {
      console.log('[MPV stdout]', data.toString())
    })

    this.mpvProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString()
      if (!msg.includes('Cannot decode')) { // фільтруємо нешкідливі помилки
        console.warn('[MPV stderr]', msg)
      }
    })

    this.mpvProcess.on('exit', (code) => {
      console.log(`[MPV] процес завершено з кодом ${code}`)
      this.isConnected = false
      this.mpvProcess = null
      this.emit('exit', code)
    })

    this.mpvProcess.on('error', (err) => {
      console.error('[MPV] помилка процесу:', err)
      this.emit('error', err)
    })

    // Підключення до IPC через named pipe
    await this.connectIpc()
  }

  /**
   * Підключення до mpv IPC named pipe
   */
  private async connectIpc(retries = 5): Promise<void> {
    for (let i = 0; i < retries; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500 + i * 300))
      try {
        await this.tryConnectIpc()
        this.isConnected = true
        this.emit('connected')
        return
      } catch {
        console.log(`[MPV IPC] спроба ${i + 1}/${retries}...`)
      }
    }
    throw new Error('Не вдалося підключитися до MPV IPC')
  }

  private tryConnectIpc(): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(CURRENT_PIPE_NAME)

      client.on('connect', () => {
        this.ipcClient = client
        this.setupIpcListeners()
        resolve()
      })

      client.on('error', (err) => {
        client.destroy()
        reject(err)
      })

      // Таймаут підключення
      setTimeout(() => {
        client.destroy()
        reject(new Error('Таймаут підключення до IPC'))
      }, 2000)
    })
  }

  private setupIpcListeners(): void {
    if (!this.ipcClient) return

    let buffer = ''

    this.ipcClient.on('data', (data: Buffer) => {
      const raw = data.toString()
      buffer += raw
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          logDebug('RECV: ' + line)

          // Відповідь на команду
          if (msg.request_id !== undefined) {
            const pending = this.pendingCommands.get(msg.request_id)
            if (pending) {
              this.pendingCommands.delete(msg.request_id)
              if (msg.error && msg.error !== 'success') {
                pending.reject(new Error(`MPV Error: ${msg.error}`))
              } else {
                pending.resolve(msg.data)
              }
            }
          }

          // Event від mpv
          if (msg.event) {
            this.handleMpvEvent(msg)
          }
        } catch {
          // Ігноруємо неповні рядки
        }
      }
    })

    this.ipcClient.on('close', () => {
      this.isConnected = false
      this.ipcClient = null
      this.emit('disconnected')
    })
  }

  private handleMpvEvent(event: { event: string; data?: unknown }): void {
    switch (event.event) {
      case 'playback-restart':
        this.emit('play')
        break
      case 'pause':
        this.emit('pause')
        break
      case 'unpause':
        this.emit('play')
        break
      case 'end-file': {
        const reason = (event as any).reason
        if (reason === 'error') {
          this.emit('error', (event as any).error || 'Помилка відтворення потоку')
        } else {
          this.emit('ended')
        }
        break
      }
      case 'seek':
        this.emit('seek')
        break
    }
  }

  /**
   * Відправка команди до mpv через IPC
   */
  private sendCommand(command: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ipcClient || !this.isConnected) {
        reject(new Error('MPV IPC не підключено'))
        return
      }

      const id = ++this.commandId
      const msg = JSON.stringify({ command, request_id: id }) + '\n'
      logDebug('SEND: ' + msg.trim())

      this.pendingCommands.set(id, { resolve, reject })

      this.ipcClient.write(msg, (err) => {
        if (err) {
          this.pendingCommands.delete(id)
          reject(err)
        }
      })

      // Таймаут відповіді
      setTimeout(() => {
        if (this.pendingCommands.has(id)) {
          this.pendingCommands.delete(id)
          resolve(null)
        }
      }, 5000)
    })
  }

  /** Встановлення властивості mpv */
  private async setProperty(name: string, value: unknown): Promise<void> {
    await this.sendCommand(['set_property', name, value])
  }

  /** Отримання властивості mpv */
  private async getProperty(name: string): Promise<unknown> {
    return this.sendCommand(['get_property', name])
  }

  // ----- Публічне API -----

  /** Завантаження і відтворення URL */
  async loadFile(url: string): Promise<void> {
    await this.sendCommand(['loadfile', url, 'replace'])
  }

  /** Пауза/відновлення */
  async togglePause(): Promise<void> {
    await this.sendCommand(['cycle', 'pause'])
  }

  /** Встановити паузу */
  async setPause(paused: boolean): Promise<void> {
    await this.setProperty('pause', paused)
  }

  /** Перемотування */
  async seek(position: number, type: 'absolute' | 'relative' = 'absolute'): Promise<void> {
    await this.sendCommand(['seek', position, type])
  }

  /** Гучність (0-100) */
  async setVolume(volume: number): Promise<void> {
    await this.setProperty('volume', Math.max(0, Math.min(100, volume)))
  }

  /** Mute */
  async setMute(muted: boolean): Promise<void> {
    await this.setProperty('mute', muted)
  }

  /** Отримати поточну позицію (секунди) */
  async getPosition(): Promise<number> {
    try {
      return ((await this.getProperty('time-pos')) as number) || 0
    } catch {
      return 0
    }
  }

  /** Отримати тривалість (секунди) */
  async getDuration(): Promise<number> {
    try {
      return ((await this.getProperty('duration')) as number) || 0
    } catch {
      return 0
    }
  }

  /** Отримати гучність */
  async getVolume(): Promise<number> {
    try {
      return ((await this.getProperty('volume')) as number) || 100
    } catch {
      return 100
    }
  }

  /** Отримати стан паузи */
  async isPaused(): Promise<boolean> {
    try {
      return ((await this.getProperty('pause')) as boolean) || false
    } catch {
      return false
    }
  }

  /** Зупинка та завершення mpv */
  async stop(): Promise<void> {
    if (this.ipcClient) {
      try {
        await this.sendCommand(['quit'])
      } catch {
        // ігноруємо помилки при зупинці
      }
      this.ipcClient.destroy()
      this.ipcClient = null
    }

    if (this.mpvProcess) {
      this.mpvProcess.kill('SIGTERM')
      this.mpvProcess = null
    }

    this.isConnected = false
  }

  /** Чи запущено mpv */
  get isRunning(): boolean {
    return this.mpvProcess !== null && this.isConnected
  }
}

// Синглтон
export const mpvService = new MpvService()


