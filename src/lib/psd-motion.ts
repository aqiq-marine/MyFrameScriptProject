import { useSyncExternalStore } from "react"

export type PsdMotionOptions = Record<string, unknown>

export type PsdCanvasTransform = {
  x?: number
  y?: number
  scaleX?: number
  scaleY?: number
  rotation?: number
  opacity?: number
  anchorX?: number
  anchorY?: number
}

export type PsdMotionContext = {
  frame: number
  globalFrame: number
  progress: number
  durationFrames: number
  variables: Record<string, unknown>
}

export type PsdMotionResult = {
  options?: PsdMotionOptions
  transform?: PsdCanvasTransform
}

export type PsdMotionSegment = {
  id: string
  characterId: string
  projectStartFrame: number
  durationFrames: number
  clipId?: string
  priority?: number
  variables?: Record<string, unknown>
  evaluate: (context: PsdMotionContext) => PsdMotionResult
}

let segments: PsdMotionSegment[] = []
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const notify = () => listeners.forEach((listener) => listener())

export const registerPsdMotionGlobal = (segment: PsdMotionSegment) => {
  const previous = segments.find((item) => item.id === segment.id)
  if (previous === segment) return
  segments = [...segments.filter((item) => item.id !== segment.id), segment]
  notify()
}

export const unregisterPsdMotionGlobal = (id: string) => {
  const next = segments.filter((segment) => segment.id !== id)
  if (next.length === segments.length) return
  segments = next
  notify()
}

export const usePsdMotionSegments = () =>
  useSyncExternalStore(subscribe, () => segments, () => segments)

export const resolvePsdMotionSegments = (
  list: PsdMotionSegment[],
  characterId: string,
  globalFrame: number,
) => {
  return list
    .filter(
      (segment) =>
        segment.characterId === characterId &&
        globalFrame >= segment.projectStartFrame &&
        globalFrame < segment.projectStartFrame + segment.durationFrames,
    )
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    .map((segment) => {
      const frame = globalFrame - segment.projectStartFrame
      const durationFrames = Math.max(0, segment.durationFrames)
      const progress = durationFrames <= 1 ? 1 : frame / (durationFrames - 1)
      return segment.evaluate({
        frame,
        globalFrame,
        progress,
        durationFrames,
        variables: segment.variables ?? {},
      })
    })
}

export const mergePsdMotionOptions = (results: PsdMotionResult[]) =>
  Object.assign({}, ...results.map((result) => result.options ?? {}))

export const mergePsdCanvasTransforms = (
  transforms: Array<PsdCanvasTransform | undefined>,
): PsdCanvasTransform => {
  const result: PsdCanvasTransform = {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
  }
  for (const transform of transforms) {
    if (!transform) continue
    result.x! += transform.x ?? 0
    result.y! += transform.y ?? 0
    result.scaleX! *= transform.scaleX ?? 1
    result.scaleY! *= transform.scaleY ?? 1
    result.rotation! += transform.rotation ?? 0
    result.opacity! *= transform.opacity ?? 1
    if (transform.anchorX != null) result.anchorX = transform.anchorX
    if (transform.anchorY != null) result.anchorY = transform.anchorY
  }
  return result
}
