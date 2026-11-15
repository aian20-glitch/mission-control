import { Suspense, lazy, useEffect, useState } from 'react'
import type { OrbitId } from '../logic/types'
import { useMission } from '../store/useMission'
import { loadStageScene } from '../three/preload'
import { stageView } from '../three/stageView'
import { SceneBoundary } from './SceneBoundary'

const StageScene = lazy(loadStageScene)

// The 3D picture behind the title, target and orbit screens. It stays in place while those
// screens change on top of it, so the camera can fly from one view to the next without a cut.
export function SpaceStage() {
  const design = useMission((s) => s.design)
  const [orbitId, setOrbitId] = useState<OrbitId>('orbiter')

  // The orbit screen tells the stage which way of meeting the planet to show.
  useEffect(() => {
    stageView.onOrbitChange = () => {
      if (stageView.orbitId) {
        setOrbitId(stageView.orbitId as OrbitId)
      }
    }
    return () => {
      stageView.onOrbitChange = null
    }
  }, [])
  return (
    <div className="space-stage">
      <SceneBoundary>
        <Suspense fallback={null}>
          <StageScene design={design} orbitId={orbitId} onPick={(stop) => stageView.onPick?.(stop)} />
        </Suspense>
      </SceneBoundary>
    </div>
  )
}
