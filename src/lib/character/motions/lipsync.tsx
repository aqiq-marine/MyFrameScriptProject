import { useMemo } from "react"
import { useVariable } from "../../animation"
import { useClipRange } from "../../clip"
import { PsdMotion } from "../psd-motion-component"

export type MouseState7 =
  | "A"
  | "I"
  | "U"
  | "E"
  | "O"
  | "N"
  | "X"

export type MouthOptions7 = {
  Path: string
} & Record<MouseState7, string>

export type LipsyncKeyframe = {
  start: number
  state: MouseState7
}

export type LipsyncMotionProps = {
  characterId: string
  psdOptions: MouthOptions7
  sequence: readonly LipsyncKeyframe[]
}

const resolveLipsyncState = (
  sequence: readonly LipsyncKeyframe[],
  frame: number,
): MouseState7 => {
  let left = 0
  let right = sequence.length

  while (left < right) {
    const mid = (left + right) >> 1

    if (sequence[mid].start <= frame) {
      left = mid + 1
    } else {
      right = mid
    }
  }

  if (left === 0) {
    return "X"
  }

  return sequence[left - 1].state
}

export const LipsyncMotion = ({
  characterId,
  psdOptions,
  sequence,
}: LipsyncMotionProps) => {
  const range = useClipRange() ?? { start: 0, end: 0 }

  // sequence が毎回新しい配列になる可能性を考慮
  const schedule = useMemo(() => [...sequence], [sequence])

  return (
    <PsdMotion
      characterId={characterId}
      variables={{ t: useVariable(0) }}
      animation={async (ctx, v) => {
        await ctx.move(v.t).to(1, range.end - range.start)
      }}
      motion={({ globalFrame }) => {
        const state = resolveLipsyncState(
          schedule,
          globalFrame - range.start,
        )

        return {
          options: {
            [psdOptions.Path]: psdOptions[state],
          },
        }
      }}
    />
  )
}
