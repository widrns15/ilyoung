import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../state/AppContext'
import { PERSON_COLORS } from '../lib/meta'

export default function SettingsSheet({ onClose }) {
  const { profile, partner, couple, theme, setTheme, guard, toast, refreshCouple } = useApp()
  const [name, setName] = useState(profile?.display_name || '')

  const saveName = async () => {
    const v = name.trim()
    if (!v || v === profile.display_name) return
    const { ok } = await guard(async () => {
      const { error } = await supabase.from('profiles').update({ display_name: v }).eq('id', profile.id)
      if (error) throw error
    })
    if (ok) { toast('이름을 바꿨어요.'); refreshCouple() }
  }

  const setColor = async (color) => {
    const { ok } = await guard(async () => {
      const { error } = await supabase.from('profiles').update({ color }).eq('id', profile.id)
      if (error) throw error
    })
    if (ok) refreshCouple()
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(couple?.invite_code || '')
      toast('초대 코드를 복사했어요.')
    } catch { /* noop */ }
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="설정">
        <div className="sheet-handle" />
        <div className="sheet-head"><span className="sheet-title">설정</span></div>

        <h4>내 정보</h4>
        <div className="card">
          <div className="settings-row">
            <span className="k">이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} maxLength={12} />
          </div>
          <div className="settings-row">
            <span className="k">내 색</span>
            <div className="color-row">
              {PERSON_COLORS.map((c) => (
                <button
                  key={c} style={{ background: c }}
                  className={profile?.color === c ? 'on' : ''}
                  onClick={() => setColor(c)}
                  aria-label={`색 ${c}`}
                  disabled={partner?.color === c}
                />
              ))}
            </div>
          </div>
        </div>

        <h4>우리</h4>
        <div className="card">
          <div className="settings-row">
            <span className="k">상대방</span>
            <span className="v">
              {partner ? (
                <><span className="legend-dot" style={{ background: partner.color }} />{partner.display_name}</>
              ) : '아직 연결 전'}
            </span>
          </div>
          <div className="settings-row">
            <span className="k">초대 코드</span>
            <button className="v num" onClick={copyCode} style={{ fontWeight: 700, letterSpacing: '0.1em' }}>
              {couple?.invite_code} 복사
            </button>
          </div>
        </div>

        <h4>화면</h4>
        <div className="card" style={{ padding: 12 }}>
          <div className="seg">
            {[['light', '라이트'], ['system', '시스템'], ['dark', '다크']].map(([v, l]) => (
              <button key={v} className={theme === v ? 'on' : ''} onClick={() => setTheme(v)}>{l}</button>
            ))}
          </div>
        </div>

        <button className="btn danger" style={{ marginTop: 16 }} onClick={() => supabase.auth.signOut()}>
          로그아웃
        </button>
      </div>
    </>
  )
}
