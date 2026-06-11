import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../state/AppContext'

export default function PairScreen() {
  const { profile, couple, guard, toast, refreshCouple } = useApp()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const hasCouple = Boolean(profile?.couple_id)

  // 코드 화면에서 파트너 참여 대기 (실시간 + 5초 폴링 백업)
  useEffect(() => {
    if (!hasCouple) return
    const t = setInterval(refreshCouple, 5000)
    return () => clearInterval(t)
  }, [hasCouple, refreshCouple])

  const createCouple = async () => {
    setBusy(true)
    const { ok } = await guard(async () => {
      const { error } = await supabase.rpc('create_couple')
      if (error) throw error
    })
    if (ok) await refreshCouple()
    setBusy(false)
  }

  const joinCouple = async (e) => {
    e.preventDefault()
    setBusy(true)
    const { ok } = await guard(async () => {
      const { error } = await supabase.rpc('join_couple', { code })
      if (error) throw error
    })
    if (ok) { toast('연결됐어요! 🎉'); await refreshCouple() }
    setBusy(false)
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(couple?.invite_code || '')
      toast('초대 코드를 복사했어요.')
    } catch {
      toast('길게 눌러 직접 복사해주세요.')
    }
  }

  if (hasCouple) {
    return (
      <div className="auth-wrap">
        <div className="logo-mark" aria-hidden>
          <span style={{ background: profile?.color || '#F2685C' }} />
          <span style={{ background: '#9aa1ab' }} />
        </div>
        <h1>초대 코드</h1>
        <p className="sub">상대방이 가입 후 이 코드를 입력하면 바로 연결돼요.</p>
        <button className="invite-code num" onClick={copyCode} title="탭하면 복사돼요">
          {couple?.invite_code || '······'}
        </button>
        <button className="btn ghost" onClick={copyCode}>코드 복사</button>
        <div className="waiting">
          <span className="pulse" /> 상대방을 기다리는 중… 연결되면 자동으로 시작돼요
        </div>
        <button className="btn danger" onClick={() => supabase.auth.signOut()}>로그아웃</button>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="logo-mark" aria-hidden>
        <span style={{ background: '#F2685C' }} />
        <span style={{ background: '#4D7CFE' }} />
      </div>
      <h1>둘을 연결할게요</h1>
      <p className="sub">
        {profile?.display_name}님, 환영해요!
        <br />한 명이 코드를 만들고, 다른 한 명이 입력하면 끝이에요.
      </p>
      <button className="btn" onClick={createCouple} disabled={busy}>
        내가 초대 코드 만들기
      </button>
      <p className="auth-switch">또는 받은 코드 입력하기</p>
      <form className="form" onSubmit={joinCouple}>
        <div className="code-input">
          <input
            placeholder="ABC123" required minLength={6} maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters" autoComplete="off"
          />
        </div>
        <button className="btn ghost" disabled={busy || code.length < 6}>코드로 연결하기</button>
      </form>
      <button className="btn danger" onClick={() => supabase.auth.signOut()}>로그아웃</button>
    </div>
  )
}
