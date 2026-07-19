import { useAnimation, useVariable } from "../../src/lib/animation"
import { DrawText } from "../../src/lib/animation/effect/draw-text"
import { BEZIER_SMOOTH } from "../../src/lib/animation/functions"
import { Clip, ClipStatic } from "../../src/lib/clip"
import { seconds, useCurrentFrame } from "../../src/lib/frame"
import { FillFrame } from "../../src/lib/layout/fill-frame"
import { Project } from "../../src/lib/project"
import { TimeLine } from "../../src/lib/timeline"
import { createBlink, createLipSync, generateBlinkData, Motion, MotionWithVars, PsdCharacter, Voice } from "../../src/lib/character/character-unit"
import type { CSSProperties } from "react"
import { framesToSeconds } from "../../src/lib/audio"
import { assets } from "../../assets/voice_test/assets"


const buildJsonUrl = (path: string) => {  
  const url = new URL("http://localhost:3000/file")  
  url.searchParams.set("path", path)  
  return url.toString()  
}

const loadJsonFile = async <T = any>(path: string): Promise<T> => {  
  const url = buildJsonUrl(path)  
    
  try {  
    const response = await fetch(url)  
    if (!response.ok) {  
      throw new Error(`Failed to load JSON: ${response.status}`)  
    }  
      
    const text = await response.text()  
    return JSON.parse(text) as T  
  } catch (error) {  
    console.error(`Error loading JSON file ${path}:`, error)  
    throw error  
  }  
}

interface AssetData {
  files: {
    audio_path: string,
    lipsync_path: string,
    lipsync_data: any,
    script_path: string,
    script_text: string,
    starts: number[]
  }[]
}



const aoiDict = {
    eyeOptions: {
        kind: "bool" as const,
        options: {
            Default: "あおい全身/顔パーツ/目/標準",
            Open: "あおい全身/顔パーツ/目/標準",
            HalfOpen: "あおい全身/顔パーツ/目/細目",
            HalfClosed: "あおい全身/顔パーツ/目/細目もっと",
            Closed: "あおい全身/顔パーツ/目/つむる",
        }

    },
    mouthOptions: {
        kind: "bool" as const,
        options: {
            Default: "あおい全身/顔パーツ/口/あ", 
            A: "あおい全身/顔パーツ/口/あ", 
            I: "あおい全身/顔パーツ/口/い", 
            U: "あおい全身/顔パーツ/口/う", 
            E: "あおい全身/顔パーツ/口/え", 
            O: "あおい全身/顔パーツ/口/お", 
            X: "あおい全身/顔パーツ/口/にま", 
        }
    }
}

type TextProps = {
  text: string
  size?: number
  weight?: number
  color?: string
  outlineColor?: string
  outlineWidth?: number
  shadow?: string
  letterSpacing?: number | string
  lineHeight?: number | string
  fontFamily?: string
  style?: CSSProperties
}

export const Text = ({
  text,
  size = 52,
  weight = 700,
  color = "#050505",
  outlineColor = "#ffffff",
  // outlineColor = "#FFDE42",
  outlineWidth = 7,
  shadow = "0 0 16px rgba(17, 31, 162, 0.0)",
  letterSpacing = "0.04em",
  lineHeight = 1,
  fontFamily,
  style,
}: TextProps) => {
  const baseStyle: CSSProperties = {
    position: "relative",
    display: "inline-block",
    fontSize: size,
    fontWeight: weight,
    letterSpacing,
    lineHeight,
    fontFamily,
  }

  return (
    <span style={style ? { ...baseStyle, ...style } : baseStyle}>
      <span
        style={{
          position: "absolute",
          inset: 0,
          WebkitTextStroke: `${outlineWidth}px ${outlineColor}`,
          WebkitTextFillColor: "transparent",
          color: "transparent",
          textShadow: shadow,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
      <span style={{ position: "relative", color, whiteSpace: "nowrap" }}>{text}</span>
    </span>
  )
}



const StaticJimaku = ({text}: { text: string }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 50,
        textAlign: "center",
      }}
    >
      <Text text={text} color="#5478FF" />
    </div>
  )
}

const Jimaku = ({ text, starts }: { text: string, starts: number[] }) => {
  const f = useCurrentFrame();
  const t = framesToSeconds(f);

  if (f == 0) {
    return null
  }

  const threshold = 28;

  const split_text: string[] = [];
  const split_starts: number[] = [];

  // 1. 読点で分割
  const chunks = text.split('、');

  let cur_chunk = '';
  let cur_start_index = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    // threshold以下なら連結
    if ((cur_chunk + chunk).length <= threshold) {
      if (cur_chunk === '') {
        cur_start_index = i; // このまとまりの最初のチャンクのindex
        cur_chunk = chunk;
      } else {
        cur_chunk += '、' + chunk;
      }
    } else {
      // まとまりを保存
      split_text.push(cur_chunk);
      split_starts.push(starts[cur_start_index]);
      // 新しいまとまりに切り替え
      cur_chunk = chunk;
      cur_start_index = i;
    }
  }

  // 残りのチャンクがあれば追加
  if (cur_chunk !== '') {
    split_text.push(cur_chunk);
    split_starts.push(starts[cur_start_index]);
  }

  // 現在のフレームから表示するテキストを取得

  let cur_text_index = 0;
  for (let i = 0; i < split_starts.length; i++) {
    if (split_starts[i] <= t) {
      cur_text_index = i;
    }
  }

  const current_text = split_text[cur_text_index];
  return <StaticJimaku text={current_text} />;
};


// const Blink = createBlink(aoiDict.eyeOptions)
// const blink = generateBlinkData(0, 6000)
// const LipSync = createLipSync(aoiDict.mouthOptions)

// const Aoi = ({index, className, motion}: {index: number, className?: string, motion?: any}) => {
//   const [aoiAssets, setAoiAssets] = useState<AssetData | null>(null)
//   
//   useEffect(() => {
//     if (aoiAssets) return
//   
//     const load = async () => {
//       const data = await loadJsonFile<AssetData>("assets/dft/bundle_with_starts.json")
//       setAoiAssets(data)
//     }
//   
//     load()
//   }, [])
//   
//   if (!aoiAssets) {
//     return null
//   }
//   const urlPrefix = "assets"
//   const psd = urlPrefix + "/琴葉葵立ち絵全身配布用.psd"
//   const files = aoiAssets.files[index]
//   const lipsync = files.lipsync_data
//   const text = files.script_text
// 
// 
//   return (
//       <Clip>
//         <PsdCharacter psd={psd} renderOptions={{flipx: true}} className={className ?? "aoi"}>
//             <Voice voice={urlPrefix + "/dft/" + files.audio} volume={1}/>
//             <Blink data={blink} />
//             <LipSync data={lipsync} />
//             {motion}
//         </PsdCharacter>
//         <Jimaku text={text} starts={files.starts}/>
//       </Clip>
//     )
// }


export const MYPROJECT = () => {
  return (
    <Project>
      <TimeLine>
        <ClipStatic start={0} end={seconds(1)} label="Hello">
          <Jimaku text="hogehoge" starts={[]} />
        </ClipStatic>
      </TimeLine>
    </Project>
  )
}
