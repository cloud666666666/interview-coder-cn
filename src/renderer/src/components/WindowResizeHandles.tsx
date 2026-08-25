import type { PointerEvent as ReactPointerEvent } from 'react'

type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

const directions: ResizeDirection[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

export function WindowResizeHandles({ enabled }: { enabled: boolean }) {
  if (!enabled) return null

  const startResize = (event: ReactPointerEvent<HTMLDivElement>, direction: ResizeDirection) => {
    if (event.button !== 0) return
    // Main follows the cursor from here on; capture is only to keep the pointerup
    // coming back to this element, and is allowed to fail (it does on macOS panels)
    event.currentTarget.setPointerCapture(event.pointerId)
    window.api.startWindowResize(direction)
  }

  const stopResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    window.api.stopWindowResize()
  }

  return directions.map((direction) => (
    <div
      key={direction}
      className={`window-resize-handle window-resize-${direction}`}
      onPointerDown={(event) => startResize(event, direction)}
      onPointerUp={stopResize}
      onPointerCancel={stopResize}
    />
  ))
}
