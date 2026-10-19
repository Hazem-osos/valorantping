import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { APP_ID } from '../shared/constants'
import { registerIpc, stopBackgroundWork } from './ipc'
import { applyAppSecurity, applyWindowSecurity } from './security'

app.setAppUserModelId(APP_ID)

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#07080A',
    title: 'Riyadh Ping Optimizer',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  applyWindowSecurity(win)

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  applyAppSecurity()
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopBackgroundWork()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopBackgroundWork()
})
