import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { registerIpcHandlers, setMigrationStatus } from './ipc/register'
import { getDb, closeDb } from './db/connection'
import { runMigrations } from './db/migrate'
import { initModules } from './modules/registry'
import { runCloseBackup, runStartupBackup } from './core/backup/ipc'

function initDatabase(): void {
  try {
    const db = getDb()
    runMigrations(db)
    initModules({ db })
    setMigrationStatus(true, null)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database initialization failed'
    console.error('Fatal: Failed to apply database migrations:', error)
    setMigrationStatus(false, message)
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  initDatabase()
  registerIpcHandlers()
  createWindow()
  setTimeout(() => void runStartupBackup(), 5000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

let closing = false
app.on('window-all-closed', () => {
  if (closing) return
  closing = true
  // Backup on close, but never hold the app open for more than a few seconds.
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 8000))
  void Promise.race([runCloseBackup(), timeout]).finally(() => {
    closeDb()
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
})
