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
type Break = {
  char: number;
  time: number;
  priority: number;
};

const BASIC_CHARS_THRESHOLD = 25;
const ALLOW_CHARS = 30;

type JimakuSegment = {
  time: number;
  startChar: number;
  endChar: number;
};

type DPState = {
  cost: number;
  prev: number;
};

const createSegments = (
  text: string,
  breaks: Break[],
): JimakuSegment[] => {
  if (breaks.length === 0) {
    return [];
  }

  const n = breaks.length;

  const dp: DPState[] = Array.from(
    { length: n },
    () => ({
      cost: Infinity,
      prev: -1,
    }),
  );

  dp[0] = {
    cost: 0,
    prev: -1,
  };

  for (let i = 0; i < n; i++) {
    if (dp[i].cost === Infinity) {
      continue;
    }

    let foundWithinLimit = false;

    for (let j = i + 1; j < n; j++) {
      const length =
        breaks[j].char - breaks[i].char;

      // 30字以内なら通常通り候補にする
      if (length <= ALLOW_CHARS) {
        foundWithinLimit = true;

        const cost =
          (length - BASIC_CHARS_THRESHOLD) ** 2;

        const newCost = dp[i].cost + cost;

        if (newCost < dp[j].cost) {
          dp[j] = {
            cost: newCost,
            prev: i,
          };
        }

        continue;
      }

      // 30字以内のbreakが1つもなかった場合は、
      // 最初に30字を超えたbreakを強制的に採用する
      if (!foundWithinLimit) {
        const cost =
          (length - BASIC_CHARS_THRESHOLD) ** 2;

        const newCost = dp[i].cost + cost;

        if (newCost < dp[j].cost) {
          dp[j] = {
            cost: newCost,
            prev: i,
          };
        }
      }

      // これ以降はさらに長くなるので終了
      break;
    }
  }

  // 最後のbreakからtext末尾まで
  let bestCost = Infinity;
  let bestIndex = -1;

  for (let i = 0; i < n; i++) {
    if (dp[i].cost === Infinity) {
      continue;
    }

    const length = text.length - breaks[i].char;

    const cost =
      (length - BASIC_CHARS_THRESHOLD) ** 2;

    const totalCost = dp[i].cost + cost;

    if (totalCost < bestCost) {
      bestCost = totalCost;
      bestIndex = i;
    }
  }

  if (bestIndex === -1) {
    return [];
  }

  // 最適な分割を復元
  const indices: number[] = [];

  let current = bestIndex;

  while (current !== -1) {
    indices.push(current);
    current = dp[current].prev;
  }

  indices.reverse();

  const segments: JimakuSegment[] = [];

  for (let i = 0; i < indices.length; i++) {
    const startIndex = indices[i];
    const endIndex = indices[i + 1];

    segments.push({
      time: breaks[startIndex].time,
      startChar: breaks[startIndex].char,
      endChar:
        endIndex !== undefined
          ? breaks[endIndex].char
          : text.length,
    });
  }

  return segments;
};


export const Jimaku = ({
  text,
  breaks,
}: {
  text: string;
  breaks: Break[];
}) => {
  const f = useCurrentFrame();
  const t = framesToSeconds(f);

  if (f === 0) {
    return null;
  }

  const segments = createSegments(text, breaks);

  let currentSegmentIndex = 0;

  for (let i = 0; i < segments.length; i++) {
    if (segments[i].time <= t) {
      currentSegmentIndex = i;
    } else {
      break;
    }
  }

  const currentSegment = segments[currentSegmentIndex];

  const currentText = text.slice(
    currentSegment.startChar,
    currentSegment.endChar,
  );

  return <StaticJimaku text={currentText} />;
};
