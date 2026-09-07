import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

// 마지막 부팅 결과 캐시: 재방문 시 서버 응답을 기다리지 않고 바로 진입
const CACHE_KEY = '1+0-couple-cache'

function readCoupleCache(userId) {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY))
    return raw?.userId === userId ? raw : null
  } catch {
    return null
  }
}

// supabase-js 가 localStorage 에 저장해 둔 세션을 직접 읽는다.
// getSession() 은 토큰 갱신·네트워크에 얽혀 iOS 복귀 직후 멈출 수 있어서,
// 부팅은 이 값으로 즉시 진입하고 서버 확인은 백그라운드에서 한다.
function readStoredSession() {
  try {
    const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]
    const raw = localStorage.getItem(`sb-${ref}-auth-token`)
    const s = JSON.parse(raw)
    return s?.user ? s : null
  } catch {
    return null
  }
}

export function AppProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = 확인 중
  const [profile, setProfile] = useState(null)
  const [partner, setPartner] = useState(null)
  const [couple, setCouple] = useState(null)
  const [booting, setBooting] = useState(true)
  const [toastMsg, setToastMsg] = useState(null)
  const toastTimer = useRef(null)

  const [theme, setTheme] = useState(
    // 구버전 키(duri-theme)에서 한 번 이어받는다
    () => localStorage.getItem('1+0-theme') || localStorage.getItem('duri-theme') || 'system'
  )

  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.dataset.theme = dark ? 'dark' : 'light'
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.content = dark ? '#121417' : '#F5F6F8'
    }
    apply()
    localStorage.setItem('duri-theme', theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  const toast = useCallback((msg) => {
    clearTimeout(toastTimer.current)
    setToastMsg(msg)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600)
  }, [])

  // 오프라인 가드: 모든 쓰기 작업 전에 호출
  const guard = useCallback(
    async (fn, { onError } = {}) => {
      if (!navigator.onLine) {
        toast('오프라인 상태예요. 온라인에서 다시 시도해주세요.')
        return { ok: false }
      }
      try {
        // 인증 웨지 등으로 요청이 영영 안 끝나면 UI 가 잠기므로 타임아웃을 둔다
        const data = await Promise.race([
          fn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000)
          ),
        ])
        return { ok: true, data }
      } catch (e) {
        if (e?.message === 'timeout') {
          toast('응답이 지연되고 있어요. 앱을 새로고침할게요.')
          setTimeout(() => window.location.reload(), 1200)
          return { ok: false, error: e }
        }
        const msg = e?.message || ''
        if (!navigator.onLine || /fetch|network/i.test(msg)) {
          toast('네트워크 연결을 확인하고 다시 시도해주세요.')
        } else {
          toast(onError || msg || '문제가 생겼어요. 다시 시도해주세요.')
        }
        return { ok: false, error: e }
      }
    },
    [toast]
  )

  const loadCoupleState = useCallback(async (userId) => {
    // 한 번의 왕복으로 나 + 파트너 + 커플 정보를 모두 가져온다 (RLS 가 두 사람 행만 보여줌)
    const { data: rows, error } = await supabase.from('profiles').select('*, couple:couples(*)')
    const meRow = rows?.find((r) => r.id === userId)
    if (error || !meRow) {
      setProfile(null); setPartner(null); setCouple(null)
      return
    }
    const { couple: myCouple, ...me } = meRow
    let mate = null
    if (me.couple_id) {
      const mateRow = rows.find((r) => r.id !== userId && r.couple_id === me.couple_id)
      if (mateRow) {
        const { couple: _c, ...rest } = mateRow
        mate = rest
      }
    }
    const coupleRow = me.couple_id ? myCouple || null : null
    setProfile(me)
    setPartner(mate)
    setCouple(coupleRow)
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, profile: me, partner: mate, couple: coupleRow }))
    } catch { /* noop */ }
  }, [])

  // 세션 부트스트랩
  useEffect(() => {
    let mounted = true

    // 즉시 진입 경로: 저장된 세션 + 커플 캐시가 있으면 네트워크를 기다리지 않는다.
    // (iOS PWA 복귀 직후 getSession 이 토큰 갱신에 막혀도 스피너에 갇히지 않게)
    const stored = readStoredSession()
    if (stored) {
      const cached = readCoupleCache(stored.user.id)
      if (cached) {
        setSession(stored)
        setProfile(cached.profile)
        setPartner(cached.partner)
        setCouple(cached.couple)
        setBooting(false)
      }
    }

    // 워치독: getSession 이 끝나야 supabase 인증이 하이드레이트되어 쓰기가 나간다.
    // 캐시로 이미 화면에 들어왔더라도(session 이 정의됐더라도) getSession 이
    // iOS 웨지로 안 끝나면 저장이 영영 멈추므로, 미해결 시 1회 새로고침으로 재초기화한다.
    let resolved = false
    const watchdog = setTimeout(() => {
      if (resolved) return
      try {
        if (sessionStorage.getItem('1+0-boot-retry')) return
        sessionStorage.setItem('1+0-boot-retry', '1')
      } catch { /* noop */ }
      window.location.reload()
    }, 4000)

    supabase.auth.getSession().then(async ({ data }) => {
      resolved = true
      clearTimeout(watchdog)
      try { sessionStorage.removeItem('1+0-boot-retry') } catch { /* noop */ }
      if (!mounted) return
      // 일시적 네트워크 문제로 세션 확인이 실패해도, 캐시로 이미 진입했다면
      // 로그인 화면으로 내쫓지 않는다 (진짜 로그아웃은 onAuthStateChange 가 처리)
      if (!data.session && stored) {
        setBooting(false)
        return
      }
      setSession(data.session)
      if (data.session) {
        const cached = readCoupleCache(data.session.user.id)
        if (cached) {
          // 캐시로 즉시 진입하고 서버 갱신은 백그라운드에서
          setProfile(cached.profile)
          setPartner(cached.partner)
          setCouple(cached.couple)
          setBooting(false)
          loadCoupleState(data.session.user.id)
          return
        }
        await loadCoupleState(data.session.user.id)
      }
      setBooting(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s)
      if (s) await loadCoupleState(s.user.id)
      else {
        setProfile(null); setPartner(null); setCouple(null)
        try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem('1+0-data-cache') } catch { /* noop */ }
      }
    })
    return () => { mounted = false; clearTimeout(watchdog); sub.subscription.unsubscribe() }
  }, [loadCoupleState])

  // 프로필 변경 실시간 구독 (파트너 참여 / 이름·색 변경 감지)
  useEffect(() => {
    if (!session) return
    const ch = supabase
      .channel('profiles-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () =>
        loadCoupleState(session.user.id)
      )
      .subscribe()
    const onFocus = () => loadCoupleState(session.user.id)
    window.addEventListener('focus', onFocus)
    return () => { supabase.removeChannel(ch); window.removeEventListener('focus', onFocus) }
  }, [session?.user?.id, loadCoupleState]) // eslint-disable-line

  const refreshCouple = useCallback(() => {
    if (session) return loadCoupleState(session.user.id)
  }, [session, loadCoupleState])

  const value = {
    session, profile, partner, couple, booting,
    theme, setTheme, toast, toastMsg, guard, refreshCouple,
    paired: Boolean(profile?.couple_id && partner),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
