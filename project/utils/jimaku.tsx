import { type CSSProperties } from "react"
import { useCurrentFrame } from "../../src/lib/frame"
import { framesToSeconds } from "../../src/lib/audio"

export type TextProps = {
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



export const StaticJimaku = ({text}: { text: string }) => {
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

export const Jimaku = ({ text, starts }: { text: string, starts: number[] }) => {
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
