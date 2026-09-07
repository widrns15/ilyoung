import { useEffect, useRef, useState } from 'react'

const RETRY_KEY = '1+0-boot-retry'
const MAX_MS = 4000 // 무슨 일이 있어도 이 시간 뒤엔 내린다 (부팅이 늦어도 갇히지 않게)
const VIDEO_WAIT_MS = 2000 // 영상이 이 안에 재생 준비가 안 되면 로고 폴백 (1.6MB, faststart 라 보통 훨씬 일찍 준비됨)
const FALLBACK_MS = 1200 // 폴백(로고)만 보여줄 최소 시간
const FADE_MS = 350

// 워치독이 강제 새로고침한 재진입에서는 스플래시를 생략한다.
// (4초 만에 두 번 재생되는 어색함 방지, 캐시로 화면이 즉시 복원되므로 충분)
export function shouldShowSplash() {
  try {
    if (sessionStorage.getItem(RETRY_KEY)) return false
  } catch {
    /* noop */
  }
  return true
}

// 앱 진입 스플래시. 영상은 무음 자동재생(iOS 필수).
// 밑에서는 캐시로 화면·데이터가 먼저 그려지므로, 영상이 끝나면 곧바로 완성된 화면이 드러난다.
// 내려가는 조건: (영상 종료 또는 영상 실패+폴백 시간 경과) AND (부팅 완료 또는 MAX_MS 경과)
export default function SplashScreen({ ready, onDone }) {
  const videoRef = useRef(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [mediaDone, setMediaDone] = useState(false)
  const [forceDone, setForceDone] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const startRef = useRef(Date.now())

  // 영상 재생 시도 + 준비 지연 시 폴백
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    let canPlay = false
    const onCanPlay = () => {
      canPlay = true
    }
    v.addEventListener('canplay', onCanPlay)
    const p = v.play()
    if (p && typeof p.catch === 'function') p.catch(() => setVideoFailed(true))
    const t = setTimeout(() => {
      if (!canPlay) setVideoFailed(true)
    }, VIDEO_WAIT_MS)
    return () => {
      clearTimeout(t)
      v.removeEventListener('canplay', onCanPlay)
    }
  }, [])

  // 영상 실패 시 로고 폴백을 잠깐 보여준 뒤 미디어 완료 처리
  useEffect(() => {
    if (!videoFailed) return
    const elapsed = Date.now() - startRef.current
    const t = setTimeout(() => setMediaDone(true), Math.max(0, FALLBACK_MS - elapsed))
    return () => clearTimeout(t)
  }, [videoFailed])

  // 상한 타이머
  useEffect(() => {
    const t = setTimeout(() => setForceDone(true), MAX_MS)
    return () => clearTimeout(t)
  }, [])

  // 내려갈 조건 충족 시 페이드아웃 후 언마운트
  useEffect(() => {
    if (leaving) return
    if ((mediaDone && ready) || forceDone) {
      setLeaving(true)
      const t = setTimeout(onDone, FADE_MS)
      return () => clearTimeout(t)
    }
  }, [mediaDone, ready, forceDone, leaving, onDone])

  return (
    <div className={`splash${leaving ? ' leaving' : ''}`} aria-hidden>
      <div className="splash-fallback">
        <div className="logo-mark">
          <span style={{ background: '#F2685C' }} />
          <span style={{ background: '#4D7CFE' }} />
        </div>
        <h1>1+0</h1>
      </div>
      {!videoFailed && (
        <video
          ref={videoRef}
          src="/splash.mp4"
          muted
          playsInline
          autoPlay
          preload="auto"
          onEnded={() => setMediaDone(true)}
          onError={() => setVideoFailed(true)}
        />
      )}
    </div>
  )
}
