import type { BrowserWindow } from 'electron'

declare global {
  var mainWindow: BrowserWindow | null
  var toolbarWindow: BrowserWindow | null
}
