import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { TOOLBAR_ACTIONS, type ToolbarActionName } from '@/lib/toolbar-actions'
import type { LucideIcon } from 'lucide-react'
import { WindowResizeHandles } from '@/components/WindowResizeHandles'

/** Mirrors `.overlay-toolbar` in main.css: `p-2` around `size-7` buttons with `gap-0.5` */
const BAR_PADDING = 8
const BUTTON_SIZE = 28
const BUTTON_GAP = 2

/**
 * Toolbar rendered in its own always-on-top window above the main window.
 * Buttons carry no `title`: a native tooltip would be drawn outside the window
 * and would therefore not be covered by the window's content protection.
 */
export function OverlayToolbar() {
  const [hoverDelay, setHoverDelay] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)
  const visibleCount = useVisibleActionCount(barRef)

  // This window has its own settings store copy, so main pushes the live value
  useEffect(() => {
    window.api.getAppSettings().then((settings) => {
      setHoverDelay(settings.toolbarHoverDelay || 0)
    })
    window.api.onSyncToolbarSettings(({ hoverDelay }) => {
      setHoverDelay(hoverDelay || 0)
    })
    return () => {
      window.api.removeSyncToolbarSettingsListener()
    }
  }, [])

  return (
    <div ref={barRef} className="overlay-toolbar overlay-toolbar-root">
      {TOOLBAR_ACTIONS.slice(0, visibleCount).map(({ action, Icon }) => (
        <ToolbarButton key={action} action={action} Icon={Icon} hoverDelay={hoverDelay} />
      ))}
      {/* Always on: main.css keeps these edges from ever showing a resize cursor */}
      <WindowResizeHandles enabled />
    </div>
  )
}

/**
 * Buttons keep their size when the toolbar window is resized; the ones that no
 * longer fit are dropped from the end, so a narrowed toolbar never shows a
 * sliver of a button. The bar's own width never depends on its children, so
 * measuring it here cannot feed back into the layout.
 */
function useVisibleActionCount(barRef: RefObject<HTMLDivElement | null>): number {
  const [count, setCount] = useState(TOOLBAR_ACTIONS.length)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    const measure = () => {
      const available = bar.clientWidth - BAR_PADDING * 2
      const fits = Math.floor((available + BUTTON_GAP) / (BUTTON_SIZE + BUTTON_GAP))
      setCount(Math.min(TOOLBAR_ACTIONS.length, Math.max(1, fits)))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [barRef])

  return count
}

/**
 * Fires on click, and — when a dwell time is configured — on hovering the button
 * for that long, which triggers the action without ever emitting a mouse click.
 */
function ToolbarButton({
  action,
  Icon,
  hoverDelay
}: {
  action: ToolbarActionName
  Icon: LucideIcon
  hoverDelay: number
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isDwelling, setIsDwelling] = useState(false)

  const cancelDwell = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsDwelling(false)
  }, [])

  // Drop a pending dwell when the setting changes or the toolbar goes away
  useEffect(() => cancelDwell, [cancelDwell, hoverDelay])

  const handleMouseEnter = () => {
    if (!hoverDelay) return
    setIsDwelling(true)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      // Stays inert until the cursor leaves and comes back, so parking the
      // mouse on a button cannot fire it over and over
      setIsDwelling(false)
      void window.api.triggerAction(action)
    }, hoverDelay)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={cancelDwell}
      onClick={() => {
        cancelDwell()
        void window.api.triggerAction(action)
      }}
    >
      <Icon />
      {isDwelling && (
        <span className="dwell-progress" style={{ animationDuration: `${hoverDelay}ms` }} />
      )}
    </Button>
  )
}
