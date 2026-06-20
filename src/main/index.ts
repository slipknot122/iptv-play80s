import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { store } from './store'
import { registerIpcHandlers } from './ipc/handlers'
import { autoUpdater } from 'electron-updater'

// ============================================================
// Electron Main Process — Точка входу застосунку
// ============================================================

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Відновлення розміру вікна з налаштувань
  const windowState = store.get('windowState')

  mainWindow = new BrowserWindow({
    width: windowState.width || 1280,
    height: windowState.height || 800,
    minWidth: 1024,
    minHeight: 600,
    show: true,
    autoHideMenuBar: true,
    frame: true,
    backgroundColor: '#0F1117',
    titleBarStyle: 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  })

  // Центрувати вікно при першому запуску
  mainWindow.center()

  // Відновлення maximized стану
  if (windowState.isMaximized) {
    mainWindow.maximize()
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    mainWindow!.focus()
    // DevTools у режимі розробки
    if (is.dev) {
      mainWindow!.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // Запасний варіант — показати вікно через 3 сек якщо ready-to-show не спрацював
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
      mainWindow.focus()
    }
  }, 3000)

  // Збереження стану вікна перед закриттям
  mainWindow.on('close', () => {
    if (!mainWindow) return
    const bounds = mainWindow.getBounds()
    store.set('windowState', {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: mainWindow.isMaximized()
    })
  })

  // Відкривати зовнішні посилання в браузері
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR для розробки або статичний файл для продакшену
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Реєстрація IPC handlers
  registerIpcHandlers(mainWindow)
}

// Ініціалізація застосунку
app.whenReady().then(() => {
  // Встановлення App User Model ID для Windows
  electronApp.setAppUserModelId('com.iptv-player')

  // Оптимізація shortcuts у розробці
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Автооновлення застосунку (тільки в продакшені)
  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify()
  }
})

// Вихід при закритті всіх вікон
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Очищення при виході
app.on('before-quit', async () => {
  const { mpvService } = await import('./services/mpv.service')
  await mpvService.stop()
})
