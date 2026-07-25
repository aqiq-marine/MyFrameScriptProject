import { useEffect, useId, useMemo } from "react"
import { useClipId, useClipRange } from "../clip"
import { useAnimation, type AnimationContext, type Variable} from "../animation"
import {
  registerPsdMotionGlobal,
  unregisterPsdMotionGlobal,
  type PsdMotionContext,
  type PsdMotionResult,
} from "../psd-motion"



type VariableValues<T extends Record<string, Variable<unknown>>> = {
  [K in keyof T]:
    T[K] extends Variable<infer U> ? U : never
}

export type PsdMotionProps<
  TVariables extends Record<string, Variable<unknown>> = Record<string, never>
> = {
  characterId: string
  id?: string
  priority?: number

  variables: TVariables

  animation: (
    ctx: AnimationContext,
    variables: TVariables,
  ) => Promise<void>

  motion: (
    context: PsdMotionContext<VariableValues<TVariables>>,
  ) => PsdMotionResult
}


/** Registers a frame-driven PSD motion segment in the global motion store. */
export const PsdMotion = <TVariables extends Record<string, Variable<unknown>> = Record<string, never>,>({
  characterId,
  id: explicitId,
  variables,
  animation,
  priority = 0,
  motion,
}: PsdMotionProps<TVariables>) => {
  const generatedId = useId()
  const id = explicitId ?? generatedId
  const clipId = useClipId()
  const range = useClipRange()
  const stableVariables = useMemo(() => variables, [variables])

  useAnimation(async (ctx) => await animation(ctx, variables), [])

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
      motion: {
        variables: stableVariables,
        evaluate: motion
      },
    })
    return () => unregisterPsdMotionGlobal(id)
  }, [characterId, clipId, id, motion, priority, range, stableVariables])

  return null
}

