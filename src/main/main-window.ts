import { join } from 'node:path'
import { shell, BrowserWindow, screen } from 'electron'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const TOOLBAR_WIDTH = 504
const TOOLBAR_HEIGHT = 52
const TOOLBAR_INSET = 4

export function applyContentProtection(window: BrowserWindow, forceReset = false): void {
  if (!window || window.isDestroyed()) return

  if (forceReset && process.platform === 'win32') {
    window.setContentProtection(false)
  }

  window.setContentProtection(true)
}

export function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    title: '',
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hiddenInMissionControl: true,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Store reference to mainWindow globally
  global.mainWindow = mainWindow
  const toolbarWindow = createToolbarWindow(mainWindow)
  global.toolbarWindow = toolbarWindow

  const syncToolbarBounds = () => {
    if (toolbarWindow.isDestroyed() || mainWindow.isDestroyed()) return
    const mainBounds = mainWindow.getBounds()
    const workArea = screen.getDisplayMatching(mainBounds).workArea
    toolbarWindow.setBounds({
      x: Math.min(Math.max(mainBounds.x, workArea.x), workArea.x + workArea.width - TOOLBAR_WIDTH),
      y: Math.max(workArea.y, mainBounds.y - TOOLBAR_HEIGHT - TOOLBAR_INSET),
      width: TOOLBAR_WIDTH,
      height: TOOLBAR_HEIGHT
    })
  }

  mainWindow.on('move', syncToolbarBounds)
  mainWindow.on('resize', syncToolbarBounds)
  mainWindow.on('show', () => {
    syncToolbarBounds()
  })
  mainWindow.on('hide', () => toolbarWindow.hide())
  mainWindow.on('closed', () => {
    if (!toolbarWindow.isDestroyed()) toolbarWindow.close()
    global.toolbarWindow = null
  })

  mainWindow.setMenuBarVisibility(false)

  // Keep the native window title empty. Chromium's window picker (Edge/Chrome
  // "share a window") enumerates windows with WebRTC's kIgnoreUntitled flag and
  // drops the ones whose title is empty, so an untitled window never shows up in
  // the list. setContentProtection only blanks the pixels; it does not hide the
  // window from enumeration. The window is frameless, so no title is ever drawn.
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
    mainWindow.setTitle('')
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    // Dock visibility is handled at startup (index.ts) and via renderer sync
    // (settings.ts); the window's own show event must not force it back on.
    applyContentProtection(mainWindow)

    // Reclaim top position when other apps steal it
    mainWindow.on('always-on-top-changed', (_event, isAlwaysOnTop) => {
      if (!isAlwaysOnTop && mainWindow.isVisible() && !mainWindow.isDestroyed()) {
        // Only re-set the flag; avoid moveTop() to not disturb other window focus
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      }
    })
  })

  mainWindow.on('show', () => {
    applyContentProtection(mainWindow)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createToolbarWindow(parent: BrowserWindow): BrowserWindow {
  const toolbarWindow = new BrowserWindow({
    width: TOOLBAR_WIDTH,
    height: TOOLBAR_HEIGHT,
    frame: false,
    transparent: true,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    parent,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  toolbarWindow.setMenuBarVisibility(false)
  toolbarWindow.setAlwaysOnTop(true, 'screen-saver', 2)
  toolbarWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  applyContentProtection(toolbarWindow)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    toolbarWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/toolbar`)
  } else {
    toolbarWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'toolbar' })
  }

  return toolbarWindow
}
