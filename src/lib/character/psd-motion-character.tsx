import { readPsd, type Psd } from "ag-psd"
import { getSchema } from "ag-psd-psdtool"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useClipActive } from "../clip"
import { useCurrentFrame, useGlobalCurrentFrame } from "../frame"
import {
  mergePsdCanvasTransforms,
  mergePsdMotionOptions,
  resolvePsdMotionSegments,
  usePsdMotionSegments,
} from "../psd-motion"

type PsdLayer = {
  name?: string
  visible?: boolean
  left?: number
  top?: number
  canvas?: HTMLCanvasElement
  imageData?: ImageData
  children?: PsdLayer[]
}

export type PsdMotionCharacterProps = {
  id: string
  psd: string
  className?: string
  style?: React.CSSProperties
}

const cache = new Map<string, Psd>()
const pending = new Map<string, Promise<Psd>>()

const getPsdUrl = (path: string) => {
  const url = new URL("http://localhost:3000/file")
  url.searchParams.set("path", path)
  return url.toString()
}

const loadPsd = async (path: string) => {
  const cached = cache.get(path)
  if (cached) return cached
  const existing = pending.get(path)
  if (existing) return existing

  const request = fetch(getPsdUrl(path))
    .then(async (response) => {
      if (!response.ok) throw new Error(`Failed to load PSD: ${path}`)
      const value = readPsd(await response.arrayBuffer(), {
        useImageData: true,
      })
      cache.set(path, value)
      return value
    })
    .finally(() => pending.delete(path))

  pending.set(path, request)
  return request
}

const imageDataCanvas = (imageData: ImageData) => {
  const canvas = document.createElement("canvas")
  canvas.width = imageData.width
  canvas.height = imageData.height
  canvas.getContext("2d")?.putImageData(imageData, 0, 0)
  return canvas
}

const layerCanvas = (layer: PsdLayer) => {
  if (layer.canvas) return layer.canvas
  if (layer.imageData) return imageDataCanvas(layer.imageData)
  return null
}

type LayerInfo = {
  layer: PsdLayer
  path: string
  name: string
  fixed: boolean
}

const parseLayerName = (rawName: string | undefined) => {
  let name = rawName ?? ""
  let fixed = false
  let option = false
  if (name.startsWith("!")) {
    fixed = true
    name = name.slice(1)
  } else if (name.startsWith("*")) {
    option = true
    name = name.slice(1)
  }
  return { name, fixed, option }
}

const flattenLeaves = (root: PsdLayer, options: Record<string, unknown>) => {
  const result: LayerInfo[] = []
  const visit = (layer: PsdLayer, parentPath: string, parentVisible: boolean) => {
    const info = parseLayerName(layer.name)
    const path = parentPath ? `${parentPath}/${info.name}` : info.name
    if (!parentVisible || layer.visible === false) return
    if (layer.children?.length) {
      for (const child of layer.children) {
        const childInfo = parseLayerName(child.name)
        const selected = options[path]
        const childVisible =
          !childInfo.option || selected === undefined || selected === childInfo.name
        visit(child, path, childVisible)
      }
    } else if (layerCanvas(layer)) {
      result.push({ layer, path, name: info.name, fixed: info.fixed })
    }
  }
  visit(root, "", true)
  return result
}

const isLayerVisible = (info: LayerInfo, options: Record<string, unknown>) => {
  if (info.fixed) return info.layer.visible !== false
  const value = options[info.path] ?? options[info.name]
  if (typeof value === "boolean") return value
  if (value && typeof value === "object" && "visible" in value) {
    return Boolean((value as { visible?: unknown }).visible)
  }
  return info.layer.visible !== false
}

const getPsdDefaults = (psd: Psd): Record<string, boolean> => {
  const schema = getSchema(psd) as {
    properties?: Record<string, { default?: boolean }>
  }

  const entries = Object.entries(schema.properties ?? {})
    .filter(([, value]) => value.default !== undefined)
    // 親を先に処理するため、階層の浅い順
    .sort(([a], [b]) => a.split("/").length - b.split("/").length)

  const result: Record<string, boolean> = {}

  for (const [key, value] of entries) {
    let enabled = value.default!

    const parts = key.split("/")

    // 親を順番に確認
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(0, i).join("/")
      if (result[parent] === false) {
        enabled = false
        break
      }
    }

    result[key] = enabled
  }

  return result
}

const drawBuffer = (
  psd: Psd,
  options: Record<string, unknown>,
  target: HTMLCanvasElement,
) => {
  const root = psd as unknown as PsdLayer
  target.width = psd.width
  target.height = psd.height
  const context = target.getContext("2d")
  if (!context) return
  context.clearRect(0, 0, target.width, target.height)
  for (const info of flattenLeaves(root, options)) {
    if (!isLayerVisible(info, options)) continue
    const source = layerCanvas(info.layer)
    if (!source) continue
    context.drawImage(source, info.layer.left ?? 0, info.layer.top ?? 0)
  }
}

const drawTransformed = (
  buffer: HTMLCanvasElement,
  target: HTMLCanvasElement,
  transform: ReturnType<typeof mergePsdCanvasTransforms>,
) => {
  target.width = buffer.width
  target.height = buffer.height
  const context = target.getContext("2d")
  if (!context) return
  context.clearRect(0, 0, target.width, target.height)

  const x = transform.x ?? 0
  const y = transform.y ?? 0
  const scaleX = transform.scaleX ?? 1
  const scaleY = transform.scaleY ?? 1
  const rotation = transform.rotation ?? 0
  const opacity = transform.opacity ?? 1
  const anchorX = transform.anchorX ?? buffer.width / 2
  const anchorY = transform.anchorY ?? buffer.height / 2

  context.save()
  context.globalAlpha = opacity
  context.translate(x + anchorX, y + anchorY)
  context.rotate(rotation)
  context.scale(scaleX, scaleY)
  context.translate(-anchorX, -anchorY)
  context.drawImage(buffer, 0, 0)
  context.restore()
}

/** PSD Character driven by frame-based global PsdMotion segments. */
export const PsdMotionCharacter = ({
  id,
  psd: psdPath,
  className,
  style,
}: PsdMotionCharacterProps) => {
  const active = useClipActive()
  const currentFrame = useCurrentFrame()
  const globalFrame = useGlobalCurrentFrame()
  const segments = usePsdMotionSegments()
  const [psd, setPsd] = useState<Psd | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bufferRef = useRef<HTMLCanvasElement | null>(null)

  const results = useMemo(
    () =>
      resolvePsdMotionSegments(segments, id, currentFrame, globalFrame),
    [currentFrame, globalFrame, id, segments],
  )

  const defaults = useMemo(
    () => psd ? getPsdDefaults(psd) : {},
    [psd],
  )

  const options = useMemo(
    () => ({
        ...defaults,
        ...mergePsdMotionOptions(results),
    }),
    [defaults, results],
  )

  const transform = useMemo(
    () => mergePsdCanvasTransforms(results.map((result) => result.transform)),
    [results],
  )

  useEffect(() => {
    let alive = true
    // setPsd(null)
    loadPsd(psdPath)
      .then((value) => {
        if (alive) setPsd(value)
      })
      .catch((error) => console.error("PsdMotionCharacter: failed to load psd", error))
    return () => {
      alive = false
    }
  }, [psdPath])

  const draw = useCallback(() => {
    const currentPsd = psd
    const target = canvasRef.current
    if (!currentPsd || !target || !active) return
    const buffer = bufferRef.current ?? document.createElement("canvas")
    bufferRef.current = buffer
    drawBuffer(currentPsd, options, buffer)
    drawTransformed(buffer, target, transform)
  }, [active, options, psd, transform])

  useEffect(() => {
    draw()
  }, [draw, globalFrame])

  return <canvas ref={canvasRef} className={className} style={style} />
}
