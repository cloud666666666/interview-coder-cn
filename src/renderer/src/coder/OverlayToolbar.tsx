import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  ChevronDown,
  ChevronUp,
  CircleStop,
  ImagePlus,
  Mic,
  MousePointer2,
  Sun,
  SunDim
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const toolbarActions = [
  { action: 'takeScreenshot', Icon: Camera },
  { action: 'appendScreenshot', Icon: ImagePlus },
  { action: 'stopSolutionStream', Icon: CircleStop },
  { action: 'ignoreOrEnableMouse', Icon: MousePointer2 },
  { action: 'pageUp', Icon: ChevronUp },
  { action: 'pageDown', Icon: ChevronDown },
  { action: 'moveMainWindowUp', Icon: ArrowUp },
  { action: 'moveMainWindowLeft', Icon: ArrowLeft },
  { action: 'moveMainWindowDown', Icon: ArrowDown },
  { action: 'moveMainWindowRight', Icon: ArrowRight },
  { action: 'increaseOpacity', Icon: Sun },
  { action: 'decreaseOpacity', Icon: SunDim },
  { action: 'toggleTranscription', Icon: Mic }
] as const

export function OverlayToolbar() {
  return (
    <div className="overlay-toolbar">
      {toolbarActions.map(({ action, Icon }, index) => (
        <Button
          key={`${action}-${index}`}
          variant="ghost"
          size="icon"
          onClick={() => void window.api.triggerAction(action)}
        >
          <Icon />
        </Button>
      ))}
    </div>
  )
}
