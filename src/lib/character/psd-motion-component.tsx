import { useEffect, useId, useMemo } from "react"
import { useClipId, useClipRange } from "../clip"
import {
  registerPsdMotionGlobal,
  unregisterPsdMotionGlobal,
  type PsdMotionContext,
  type PsdMotionResult,
} from "../psd-motion"

export type PsdMotionProps = {
  characterId: string
  id?: string
  variables?: Record<string, unknown>
  priority?: number
  motion: (context: PsdMotionContext) => PsdMotionResult
}

/** Registers a frame-driven PSD motion segment in the global motion store. */
export const PsdMotion = ({
  characterId,
  id: explicitId,
  variables = {},
  priority = 0,
  motion,
}: PsdMotionProps) => {
  const generatedId = useId()
  const id = explicitId ?? generatedId
  const clipId = useClipId()
  const range = useClipRange()
  const stableVariables = useMemo(() => variables, [variables])

  useEffect(() => {
    if (!range) return
    const durationFrames = Math.max(0, range.end - range.start + 1)
    registerPsdMotionGlobal({
      id,
      characterId,
      clipId: clipId ?? undefined,
      projectStartFrame: range.start,
      durationFrames,
      priority,
      variables: stableVariables,
      evaluate: motion,
    })
    return () => unregisterPsdMotionGlobal(id)
  }, [characterId, clipId, id, motion, priority, range, stableVariables])

  return null
}
