import { app, session, shell, type BrowserWindow } from 'electron'

export function applyAppSecurity(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) {
        void shell.openExternal(url)
      }
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event) => {
      event.preventDefault()
    })
  })
}

export function applyWindowSecurity(win: BrowserWindow): void {
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:"
        ]
      }
    })
  })
}
