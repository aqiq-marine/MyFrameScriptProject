import { useAnimation, useVariable } from "../../src/lib/animation"
import { DrawText } from "../../src/lib/animation/effect/draw-text"
import { BEZIER_SMOOTH } from "../../src/lib/animation/functions"
import { Clip, ClipSequence, ClipStatic } from "../../src/lib/clip"
import { seconds } from "../../src/lib/frame"
import { FillFrame } from "../../src/lib/layout/fill-frame"
import { Project } from "../../src/lib/project"
import { TimeLine } from "../../src/lib/timeline"
import { assets } from "../../assets/voice_test/assets"
import { type AssetFile } from "../../assets/voice_test/asset_types"

import { aoiDict } from "../../assets/utils/nokuna/kotonoha_aoi_v1"
import { Jimaku } from "../utils/jimaku"
import { Sound } from "../../src/lib/sound/sound"
import { Bgm } from "../utils/bgm"
import { PsdMotionCharacter } from "../../src/lib/character/psd-motion-character"
import { PsdMotion } from "../../src/lib/character/psd-motion-component"
import { BlinkMotion } from "../../src/lib/character/motions/blink"
import { LipsyncMotion, type MouseState7 } from "../../src/lib/character/motions/lipsync"
import { PROJECT_SETTINGS } from "../project"


const convLipsync = (data: {start: number, value: string}[]) => {
  return data.map(d => ({start: d.start * PROJECT_SETTINGS.fps, state: d.value as MouseState7}))
}

const Voice = ({file}: {file: AssetFile}) => (
  <Clip>
    <LipsyncMotion characterId="aoi" psdOptions={{
      Path: aoiDict.mouthOptions.path,
      A: aoiDict.mouthOptions.options.A,
      I: aoiDict.mouthOptions.options.I,
      U: aoiDict.mouthOptions.options.U,
      E: aoiDict.mouthOptions.options.E,
      O: aoiDict.mouthOptions.options.O,
      N: aoiDict.mouthOptions.options.X,
      X: aoiDict.mouthOptions.options.X,
    }} sequence={convLipsync(file.lipsync_data)}/>
    <Sound sound={"assets/voice_test/" + file.audio_path} />
    <Jimaku text={file.script_text} starts={file.starts} />
  </Clip>
)


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
        text="Hello FrameScript world!"
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
        <HelloScene />
        <Voice file={files[0]} />
      </Clip>
      <Clip>
        <Voice file={files[1]} />
      </Clip>
      <Voice file={files[2]} />
      <Voice file={files[3]} />
      <Voice file={files[4]} />
      <Voice file={files[5]} />
    </ClipSequence>
  )
}

const BodyScene = () => {
  const files = assets.children.body.files;

  return (
    <ClipSequence>
      <Voice file={files[0]} />
      <Voice file={files[1]} />
      <Voice file={files[2]} />
      <Voice file={files[3]} />
      <Voice file={files[4]} />
      <Voice file={files[5]} />
      <Voice file={files[6]} />
    </ClipSequence>
  )
}

const ConScene = () => {
  const files = assets.children.conclusion.files;

  return (
    <ClipSequence>
      <Voice file={files[0]} />
      <Voice file={files[1]} />
      <Voice file={files[2]} />
      <Voice file={files[3]} />
      <Voice file={files[4]} />
      <Voice file={files[5]} />
    </ClipSequence>
  )
}

const Aoi = () => {
  return (
    <>
      <PsdMotionCharacter
        id="aoi"
        psd="assets/utils/nokuna/kotonoha_aoi_v1.psd"
        className="aoi"
        style={{
          position: "absolute",
          width: "100%",
        }}
      />
      <PsdMotion
        characterId="aoi"
        variables={{}}
        animation={async (_c, _v) => {}}
        motion={(_) => {
          return {
            transform: {
              y: -450,
              x: -600,
              scaleX: 0.6,
              scaleY: 0.6
            },
          }
        }}
      />
      <BlinkMotion characterId="aoi" psdOptions={{
        Path: aoiDict.eyeOptions.path,
        Open: aoiDict.eyeOptions.options.Open,
        HalfOpen: aoiDict.eyeOptions.options.HalfOpen,
        HalfClosed: aoiDict.eyeOptions.options.HalfClosed,
        Closed: aoiDict.eyeOptions.options.Closed,
      }} />
    </>
  )
}


export const MYPROJECT = () => {
  return (
    <Project>
      <TimeLine>
        <Clip>
          <Aoi />
          <ClipSequence>
            <IntroScene />
            <BodyScene />
            <ConScene />
          </ClipSequence>
          <ClipStatic start={seconds(2)} end={seconds(30)} label="bar">
            <PsdMotion
              characterId="aoi"
              variables={{x: useVariable(0)}}
              animation={async (ctx, v) => {
                await ctx.move(v.x).to(1, seconds(10))
                await ctx.move(v.x).to(0, seconds(10))
              }}
              motion={({variables: v}) => {
                return {
                  transform: {
                    x: 1000 * v.x
                  }
                }
              }}
            />
          </ClipStatic>
          <Bgm sound="assets/utils/bgm/Let_me_think_!.mp3" volume={0.1} fadeInFrames={seconds(3)} fadeOutFrames={seconds(1)} />
        </Clip>
      </TimeLine>
    </Project>
  )
}
