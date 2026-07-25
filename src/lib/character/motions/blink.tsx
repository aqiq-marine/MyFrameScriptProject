import { useMemo } from "react"
import { useVariable } from "../../animation"
import { useClipRange } from "../../clip"
import { PsdMotion } from "../psd-motion-component"

export type EyeState2 = "Open" | "Closed"
export type EyeState4 = "Open" | "HalfOpen" | "HalfClosed" | "Closed"
export type EyeOptions4 = {
  Path: string,
} & Record<EyeState4, string>

type BlinkEvent = {
  frame: number
  state: EyeState2 | EyeState4
}

// const OPEN_MIN = 90
// const OPEN_MAX = 240
const OPEN_MIN = 1
const OPEN_MAX = 2

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const generateBlinkSchedule = (
  endFrame: number,
): BlinkEvent[] => {
  const events: BlinkEvent[] = []

  let frame = randomInt(OPEN_MIN, OPEN_MAX)

  while (frame < endFrame) {
    events.push(
      { frame, state: "HalfClosed" },
      { frame: frame + 1, state: "Closed" },
      { frame: frame + 2, state: "HalfOpen" },
      { frame: frame + 3, state: "Open" },
    )

    frame += 4 + randomInt(OPEN_MIN, OPEN_MAX)
  }

  return events
}

const resolveBlinkState = (
  schedule: readonly BlinkEvent[],
  frame: number,
): BlinkEvent["state"] => {
  let left = 0
  let right = schedule.length

  while (left < right) {
    const mid = (left + right) >> 1

    if (schedule[mid].frame <= frame) {
      left = mid + 1
    } else {
      right = mid
    }
  }

  if (left === 0) {
    return "Open"
  }

  return schedule[left - 1].state
}

export type BlinkMotionProps = {
  characterId: string,
  psdOptions: EyeOptions4,
}

export const BlinkMotion = ({
  characterId,
  psdOptions,
}: BlinkMotionProps) => {
  const range = useClipRange() ?? {start: 0, end: 0}

  const schedule = useMemo(
    () => generateBlinkSchedule(range.end),
    [range.end],
  )

  return (
    <PsdMotion
      characterId={characterId}
      variables={{t: useVariable(0)}}
      animation={async (ctx, v) => {
        await ctx.move(v.t).to(1, range.end - range.start)
      }}
      motion={({ globalFrame }) => {
        const state = resolveBlinkState(
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
