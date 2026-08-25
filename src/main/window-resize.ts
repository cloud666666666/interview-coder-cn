import { BrowserWindow, ipcMain, type Rectangle } from 'electron'

export type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

type ResizeState = {
  window: BrowserWindow
  direction: ResizeDirection
  startX: number
  startY: number
  bounds: Rectangle
}

const MIN_WIDTH = 200
const MIN_HEIGHT = 52
let resizeState: ResizeState | null = null

ipcMain.on('window-resize-start', (event, direction: ResizeDirection, x: number, y: number) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || window.isDestroyed()) return
  resizeState = { window, direction, startX: x, startY: y, bounds: window.getBounds() }
})

ipcMain.on('window-resize-move', (event, x: number, y: number) => {
  if (!resizeState || resizeState.window.webContents !== event.sender) return
  resizeState.window.setBounds(resizeBounds(resizeState, x, y))
})

ipcMain.on('window-resize-stop', (event) => {
  if (resizeState?.window.webContents === event.sender) resizeState = null
})

function resizeBounds(state: ResizeState, x: number, y: number): Rectangle {
  const { bounds, direction, startX, startY } = state
  const dx = x - startX
  const dy = y - startY
  let { x: left, y: top, width, height } = bounds

  if (direction.includes('e')) width = Math.max(MIN_WIDTH, width + dx)
  if (direction.includes('s')) height = Math.max(MIN_HEIGHT, height + dy)
  if (direction.includes('w')) {
    const nextWidth = Math.max(MIN_WIDTH, width - dx)
    left += width - nextWidth
    width = nextWidth
  }
  if (direction.includes('n')) {
    const nextHeight = Math.max(MIN_HEIGHT, height - dy)
    top += height - nextHeight
    height = nextHeight
  }

  return { x: left, y: top, width, height }
}
