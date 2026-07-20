import { useCallback, useEffect, useId, useMemo, useRef } from "react"  
import { useGlobalCurrentFrame } from "../../src/lib/frame"  
import { useClipActive, useClipId, useClipRange } from "../../src/lib/clip"  
import {  
  registerAudioSegmentGlobal,  
  unregisterAudioSegmentGlobal,  
} from "../../src/lib/audio-plan"  
import { fetchAudioBuffer } from "../../src/lib/audio"  
import { useIsPlaying, useIsRender } from "../../src/lib/studio-state"  
import type { Trim } from "../../src/lib/trim"  
import { resolveTrimFrames } from "../../src/lib/trim"  
import { sound_length, type Sound, normalizeSound } from "../../src/lib/sound/sound" 
import { PROJECT_SETTINGS } from "../project"



export type BgmProps = {  
  sound: Sound | string  
  trim?: Trim  
  fadeInFrames?: number  
  fadeOutFrames?: number  
  volume?: number  
  label?: string
}  

  
export const Bgm = ({  
  sound,  
  trim,  
  fadeInFrames = 0,  
  fadeOutFrames = 0,  
  volume = 1,  
}: BgmProps) => {  
  const id = useId()  
  const clipId = useClipId()  
  const clipRange = useClipRange()  
  const isActive = useClipActive()  
  const isPlaying = useIsPlaying()  
  const isRender = useIsRender()  
  const globalFrame = useGlobalCurrentFrame()  
  const resolvedSound = useMemo(() => normalizeSound(sound), [sound])  
  const rawDurationFrames = sound_length(resolvedSound)  
  const { trimStartFrames, trimEndFrames } = useMemo(  
    () => resolveTrimFrames({ rawDurationFrames, trim }),  
    [rawDurationFrames, trim],  
  )  
  const sourceDurationFrames = Math.max(  
    0,  
    rawDurationFrames - trimStartFrames - trimEndFrames,  
  )  
  const clipDurationFrames = Math.max(0, clipRange ? clipRange.end - clipRange.start + 1 : 0)  
  const normalizedVolume = Number.isFinite(volume) ? Math.max(0, volume) : 1  
  
  // 重要: useProvideClipDuration を呼ばない = 長さを持たない  
  
  const audioCtxRef = useRef<AudioContext | null>(null)  
  const gainRef = useRef<GainNode | null>(null)  
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)  
  const playingPathRef = useRef<string | null>(null)  
  
  const stopPlayback = useCallback(() => {  
    const src = sourceRef.current  
    sourceRef.current = null  
    playingPathRef.current = null  
    if (src) {  
      try {  
        src.onended = null  
        src.stop()  
      } catch {  
        // ignore  
      }  
      try {  
        src.disconnect()  
      } catch {  
        // ignore  
      }  
    }  
  }, [])  
  
  const ensureAudioContext = useCallback(async () => {  
    if (audioCtxRef.current) return audioCtxRef.current  
    const Ctx = window.AudioContext || (window as any).webkitAudioContext  
    const ctx = new Ctx()  
    audioCtxRef.current = ctx  
    const gain = ctx.createGain()  
    gain.gain.value = 1  
    gain.connect(ctx.destination)  
    gainRef.current = gain  
    try {  
      await ctx.resume()  
    } catch {  
      // may require user gesture; retry on play  
    }  
    return ctx  
  }, [])  
  
  const startPlaybackAt = useCallback(  
    async (projectFrame: number) => {  
      if (!clipRange) return  
      const fps = PROJECT_SETTINGS.fps  
      if (fps <= 0) return  
  
      const clipStartFrame = clipRange.start  
      const clipEndFrame = clipRange.end  
      const clipDurationFrames = Math.max(0, clipEndFrame - clipStartFrame + 1)  
      if (clipDurationFrames <= 0) return  
  
      const relativeFrame = Math.max(0, projectFrame - clipStartFrame)  
      if (relativeFrame >= clipDurationFrames) return  
  
      const ctx = await ensureAudioContext()  
      try {  
        await ctx.resume()  
      } catch {  
        // ignore  
      }  
  
      const buffer = await fetchAudioBuffer(resolvedSound.path, ctx)  
  
      // ループ再生の設定  
      const offsetSec = (trimStartFrames + (relativeFrame % sourceDurationFrames)) / fps  
      const clampedOffset = Math.min(  
        Math.max(0, offsetSec),  
        Math.max(0, buffer.duration),  
      )  
  
      stopPlayback()  
  
      const source = ctx.createBufferSource()  
      source.buffer = buffer  
      source.loop = true  // ループを有効化  
      source.loopStart = trimStartFrames / fps  
      source.loopEnd = (trimStartFrames + sourceDurationFrames) / fps  
      const gain = gainRef.current ?? ctx.destination  
      source.connect(gain)  
      sourceRef.current = source  
      playingPathRef.current = resolvedSound.path  
  
      if (gainRef.current) {  
        const now = ctx.currentTime  
        const fadeInSec = Math.min(Math.max(0, fadeInFrames) / fps, clipDurationFrames / fps)  
        const remaining = Math.max(0, clipDurationFrames / fps - fadeInSec)  
        const fadeOutSec = Math.min(Math.max(0, fadeOutFrames) / fps, remaining)  
  
        gainRef.current.gain.cancelScheduledValues(now)  
        if (fadeInSec > 0) {  
          gainRef.current.gain.setValueAtTime(0, now)  
          gainRef.current.gain.linearRampToValueAtTime(  
            normalizedVolume,  
            now + fadeInSec,  
          )  
        } else {  
          gainRef.current.gain.setValueAtTime(normalizedVolume, now)  
        }  
  
        if (fadeOutSec > 0) {  
          const fadeOutStart = now + clipDurationFrames / fps - fadeOutSec  
          gainRef.current.gain.setValueAtTime(normalizedVolume, fadeOutStart)  
          gainRef.current.gain.linearRampToValueAtTime(0, now + clipDurationFrames / fps)  
        }  
      }  
  
      source.start(0, clampedOffset)  
    },  
    [  
      clipRange,  
      sourceDurationFrames,  
      ensureAudioContext,  
      fadeInFrames,  
      fadeOutFrames,  
      normalizedVolume,  
      resolvedSound.path,  
      stopPlayback,  
      trimStartFrames,  
    ],  
  )  
  
  // レンダー時のオーディオセグメント登録  
  useEffect(() => {  
    if (!clipRange) return  
  
    const projectStartFrame = clipRange.start  
    const clipDurationFrames = Math.max(0, clipRange.end - clipRange.start + 1)  
    if (clipDurationFrames <= 0) return  
  
    const fadeIn = Math.max(0, Math.round(fadeInFrames))  
    const fadeOut = Math.max(0, Math.round(fadeOutFrames))  
      
    // ループ再生なので、クリップ長をそのまま登録  
    registerAudioSegmentGlobal({  
      id,  
      source: { kind: "sound", path: resolvedSound.path },  
      clipId: clipId ?? undefined,  
      projectStartFrame,  
      sourceStartFrame: trimStartFrames,  
      durationFrames: clipDurationFrames,  
      fadeInFrames: Math.min(fadeIn, clipDurationFrames),  
      fadeOutFrames: Math.min(fadeOut, clipDurationFrames),  
      volume: normalizedVolume,  
    })  
  
    return () => {  
      unregisterAudioSegmentGlobal(id)  
    }  
  }, [  
    clipRange,  
    clipId,  
    clipDurationFrames,  
    fadeInFrames,  
    fadeOutFrames,  
    id,  
    normalizedVolume,  
    resolvedSound.path,  
    trimStartFrames,  
  ])  
  
  // Studio再生時の制御  
  useEffect(() => {  
    if (isRender) return  
  
    const shouldPlay = Boolean(clipRange) && isPlaying && isActive  
    if (!shouldPlay) {  
      stopPlayback()  
      return  
    }  
  
    void startPlaybackAt(globalFrame)  
  }, [  
    clipRange,  
    // globalFrame,  
    isActive,  
    isPlaying,  
    isRender,  
    resolvedSound.path,  
    startPlaybackAt,  
    stopPlayback,  
  ])  
  
  useEffect(() => {  
    return () => {  
      stopPlayback()  
    }  
  }, [stopPlayback])  
  
  return null  
}
