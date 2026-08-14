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
        const data = await fn()
        return { ok: true, data }
      } catch (e) {
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

  // 부팅 워치독: getSession 이 잠금 등으로 멈춰 '불러오는 중'에 갇히면 1회 자동 새로고침
  useEffect(() => {
    if (session !== undefined) {
      try { sessionStorage.removeItem('1+0-boot-retry') } catch { /* noop */ }
      return
    }
    const t = setTimeout(() => {
      try {
        if (sessionStorage.getItem('1+0-boot-retry')) return
        sessionStorage.setItem('1+0-boot-retry', '1')
        window.location.reload()
      } catch { /* noop */ }
    }, 4000)
    return () => clearTimeout(t)
  }, [session])

  // 세션 부트스트랩
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
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
        try { localStorage.removeItem(CACHE_KEY) } catch { /* noop */ }
      }
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
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
