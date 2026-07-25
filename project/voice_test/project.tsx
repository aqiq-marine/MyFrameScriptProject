import { useAnimation, useVariable } from "../../src/lib/animation"
import { DrawText } from "../../src/lib/animation/effect/draw-text"
import { BEZIER_SMOOTH } from "../../src/lib/animation/functions"
import { Clip, ClipSequence, ClipStatic, useClipRange } from "../../src/lib/clip"
import { seconds, useCurrentFrame } from "../../src/lib/frame"
import { FillFrame } from "../../src/lib/layout/fill-frame"
import { Project } from "../../src/lib/project"
import { TimeLine } from "../../src/lib/timeline"
import { createBlink, createLipSync, generateBlinkData, Motion, MotionWithVars, PsdCharacter, Voice } from "../../src/lib/character/character-unit"
import { useEffect, useState, type CSSProperties } from "react"
import { framesToSeconds } from "../../src/lib/audio"
import { assets } from "../../assets/voice_test/assets"
import { type AssetBundle, type AssetFile, type LipSyncEntry} from "../../assets/voice_test/asset_types"

import { aoiDict } from "../../assets/utils/nokuna/kotonoha_aoi_v1"
import { Jimaku } from "../utils/jimaku"
import { Sound } from "../../src/lib/sound/sound"
import { Bgm } from "../utils/bgm"
import { PsdMotionCharacter } from "../../src/lib/character/psd-motion-character"
import { PsdMotion } from "../../src/lib/character/psd-motion-component"


const Blink = createBlink(aoiDict.eyeOptions)
const blink = generateBlinkData(0, 6000)
const LipSync = createLipSync(aoiDict.mouthOptions)

const Aoi = ({data, className, motion}: {data: AssetFile, className?: string, motion?: any}) => {
  const utilPrefix = "assets/utils"
  const projPrefix = "assets/voice_test"
  const psd = utilPrefix + "/nokuna/kotonoha_aoi_v1.psd"

  return (
    <Clip>
      <PsdCharacter psd={psd} className={className ?? "aoi"}>
        <Voice voice={projPrefix + "/" + data.audio_path} volume={1}/>
        <Blink data={blink} />
        <LipSync data={data.lipsync_data} />
        {motion}
      </PsdCharacter>
      <Jimaku text={data.script_text} starts={data.starts}/>
    </Clip>
  )
}

const AoiClipToOther = ({
  data,
  className,
}: {
  data: AssetFile
  className?: string
}) => {
  const clipRange = useClipRange()

  const duration = clipRange ? clipRange.end - clipRange.start : 0
  const key = clipRange
    ? `${clipRange.start}-${clipRange.end}`
    : "no-range"

  return (
    <Aoi
      key={key}
      data={data}
      className={className}
      motion={
        <MotionWithVars
          variables={{ t: 0 as number }}
          animation={async (ctx, vars) => {
            await ctx.move(vars.t).to(1, duration + 1)
          }}
          motion={(_v, _f) => ({})}
        />
      }
    />
  )
}


const HelloScene = () => {
  const progress = useVariable(0)
  const color = useVariable("#FFFFFF")

  useAnimation(async (context) => {
    await context.parallel([
      context.move(progress).to(1, seconds(3), BEZIER_SMOOTH),
      context.move(color).to("#75a9bd", seconds(3), BEZIER_SMOOTH),
    ])
    await context.sleep(seconds(1))
    await context.move(progress).to(0, seconds(3), BEZIER_SMOOTH)
  }, [])

  return (
    <FillFrame style={{ alignItems: "center", justifyContent: "center" }}>
      <DrawText
        text="Hello, world!"
        fontUrl="assets/utils/NotoSerifCJKJP-Medium.ttf"
        strokeWidth={2}
        progress={progress}
        strokeColor={color.use()}
        fillColor={color.use()}
      />
    </FillFrame>
  )
}


const IntroScene = () => {
  const files = assets.children.introduction.files;
  return (
    <ClipSequence>
      <Clip>
        <AoiClipToOther data={files[0]} />
        <HelloScene />
      </Clip>
      <Clip>
        <Aoi data={files[1]} />
      </Clip>
      <Clip>
        <Aoi data={files[2]} />
      </Clip>
      <Clip>
        <Aoi data={files[3]} />
      </Clip>
      <Clip>
        <Aoi data={files[4]} />
      </Clip>
      <Clip>
        <Aoi data={files[5]} />
      </Clip>
    </ClipSequence>
  )
}
const BodyScene = () => {
  const files = assets.children.body.files;
  return (
    <ClipSequence>
      <Clip>
        <Aoi data={files[0]} />
      </Clip>
      <Clip>
        <Aoi data={files[1]} />
      </Clip>
      <Clip>
        <Aoi data={files[2]} />
      </Clip>
      <Clip>
        <Aoi data={files[3]} />
      </Clip>
      <Clip>
        <Aoi data={files[4]} />
      </Clip>
      <Clip>
        <Aoi data={files[5]} />
      </Clip>
      <Clip>
        <Aoi data={files[6]} />
      </Clip>
    </ClipSequence>
  )
}

const ConclusionScene = () => {
  const files = assets.children.conclusion.files;
  return (
    <ClipSequence>
      <Clip>
        <Aoi data={files[0]} />
      </Clip>
      <Clip>
        <Aoi data={files[1]} />
      </Clip>
      <Clip>
        <Aoi data={files[2]} />
      </Clip>
      <Clip>
        <Aoi data={files[3]} />
      </Clip>
      <Clip>
        <Aoi data={files[4]} />
      </Clip>
      <Clip>
        <Aoi data={files[5]} />
      </Clip>
    </ClipSequence>
  )
}


export const MYPROJECT = () => {
  return (
    <Project>
      <TimeLine>
        <Clip>
          <PsdMotionCharacter
            id="aoi"
            psd="assets/utils/nokuna/kotonoha_aoi_v1.psd"
          />
          <Clip start={0} duration={60}>
            <PsdMotion
              characterId="aoi"
              id="intro"
              variables={{
                t: useVariable(0)
              }}
              animation={async (ctx, variables) => {
                await ctx.move(variables.t).to(1, seconds(1));
              }}
              motion={({ variables }) => ({
                options: {
                },
                transform: {
                  x: variables.t * 2,
                  scaleX: 1 + variables.t * 0.1,
                  scaleY: 1 + variables.t * 0.1,
                  opacity: variables.t,
                },
              })}
            />
          </Clip>
        </Clip>
      </TimeLine>
    </Project>
  )
}
