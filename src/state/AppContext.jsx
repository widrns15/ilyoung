import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = 확인 중
  const [profile, setProfile] = useState(null)
  const [partner, setPartner] = useState(null)
  const [couple, setCouple] = useState(null)
  const [booting, setBooting] = useState(true)
  const [toastMsg, setToastMsg] = useState(null)
  const toastTimer = useRef(null)

  const [theme, setTheme] = useState(() => localStorage.getItem('duri-theme') || 'system')

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
    const { data: me, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (error) {
      setProfile(null); setPartner(null); setCouple(null)
      return
    }
    setProfile(me)
    if (me.couple_id) {
      const [{ data: members }, { data: coupleRow }] = await Promise.all([
        supabase.from('profiles').select('*').eq('couple_id', me.couple_id),
        supabase.from('couples').select('*').eq('id', me.couple_id).single(),
      ])
      setPartner((members || []).find((m) => m.id !== userId) || null)
      setCouple(coupleRow || null)
    } else {
      setPartner(null)
      setCouple(null)
    }
  }, [])

  // 세션 부트스트랩
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session) await loadCoupleState(data.session.user.id)
      setBooting(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s)
      if (s) await loadCoupleState(s.user.id)
      else { setProfile(null); setPartner(null); setCouple(null) }
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
