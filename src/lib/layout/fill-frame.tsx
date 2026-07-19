import type { CSSProperties } from "react"

/**
 * Props for a full-frame absolute container.
 *
 * 画面全体を覆うコンテナの props。
 *
 * @example
 * ```tsx
 * <FillFrame>
 *   <Background />
 * </FillFrame>
 * ```
 */
export type FillFrameProps = {
  children?: React.ReactNode
  style?: CSSProperties
}

/**
 * Full-frame absolute container.
 *
 * 画面全体を覆う絶対配置コンテナ。
 *
 * @example
 * ```tsx
 * <FillFrame style={{ alignItems: "center", justifyContent: "center" }}>
 *   <Title />
 * </FillFrame>
 * ```
 */
export const FillFrame = ({ children, style }: FillFrameProps) => {
  const base: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
  }

  return <div style={style ? { ...base, ...style } : base}>{children}</div>
}
