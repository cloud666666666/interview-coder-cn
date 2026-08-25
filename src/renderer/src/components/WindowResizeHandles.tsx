import type { PointerEvent as ReactPointerEvent } from 'react'

type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

const directions: ResizeDirection[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

export function WindowResizeHandles({ enabled }: { enabled: boolean }) {
  if (!enabled) return null

  const startResize = (event: ReactPointerEvent<HTMLDivElement>, direction: ResizeDirection) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    window.api.startWindowResize(direction, event.screenX, event.screenY)
  }

  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    window.api.moveWindowResize(event.screenX, event.screenY)
  }

  const stopResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    window.api.stopWindowResize()
  }

  return directions.map((direction) => (
    <div
      key={direction}
      className={`window-resize-handle window-resize-${direction}`}
      onPointerDown={(event) => startResize(event, direction)}
      onPointerMove={moveResize}
      onPointerUp={stopResize}
      onPointerCancel={stopResize}
    />
  ))
}
