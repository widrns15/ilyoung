import { useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useApp } from '../state/AppContext'
import { categoryEmoji, won } from '../lib/meta'
import { notifyPartner } from '../lib/push'
import Sheet from './Sheet'

export default function EventModal({ initial, defaultDay, txs, onClose, onSaved }) {
  const { profile, guard, toast } = useApp()
  const editing = Boolean(initial)
  const viewOnly = Boolean(initial?.virtual) // 반복 일정(가상) — 읽기 전용
  const [title, setTitle] = useState(initial?.title || '')
  const [memo, setMemo] = useState(initial?.memo || '')
  const [date, setDate] = useState(
    format(initial ? new Date(initial.starts_at) : defaultDay, 'yyyy-MM-dd')
  )
  const [endDate, setEndDate] = useState(
    format(initial ? new Date(initial.ends_at) : defaultDay, 'yyyy-MM-dd')
  )
  const [busy, setBusy] = useState(false)

  const linked = editing ? txs.filter((t) => t.event_id === initial.id) : []
  const linkedTotal = linked.reduce((a, t) => a + (t.type === 'expense' ? t.amount : -t.amount), 0)

  const save = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    const starts = new Date(`${date}T00:00:00`)
    const ends = new Date(`${endDate}T23:59:59`)
    if (ends < starts) {
      toast('종료가 시작보다 빠를 수 없어요.')
      setBusy(false)
      return
    }
    const payload = {
      couple_id: profile.couple_id,
      title: title.trim(),
      memo: memo.trim(),
      all_day: true,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
    }
    const { ok } = await guard(async () => {
      if (editing) {
        const { error } = await supabase.from('events').update(payload).eq('id', initial.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('events').insert({ ...payload, created_by: profile.id })
        if (error) throw error
      }
    })
    setBusy(false)
    if (ok) {
      if (!editing) {
        notifyPartner({ title: `${profile.display_name}님이 일정을 추가했어요`, body: title.trim() })
      }
      toast(editing ? '일정을 수정했어요.' : '일정을 추가했어요.'); onSaved(); onClose()
    }
  }

  const remove = async () => {
    if (!confirm('이 일정을 삭제할까요? 연결된 가계부 내역은 남아요.')) return
    const { ok } = await guard(async () => {
      const { error } = await supabase.from('events').delete().eq('id', initial.id)
      if (error) throw error
    })
    if (ok) { toast('일정을 삭제했어요.'); onSaved(); onClose() }
  }

  return (
    <Sheet onClose={onClose} label={viewOnly ? '반복 일정' : editing ? '일정 수정' : '일정 추가'}>
        <div className="sheet-head">
          <span className="sheet-title">{viewOnly ? '🔁 반복 일정' : editing ? '일정 수정' : '새 일정'}</span>
        </div>
        <form className="form" onSubmit={save}>
          <input
            placeholder="무슨 일정인가요?" required autoFocus={!editing} disabled={viewOnly}
            value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40}
          />
          <div className="form-row">
            <div>
              <label>시작</label>
              <input type="date" required disabled={viewOnly} value={date} onChange={(e) => { setDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value) }} />
            </div>
            <div>
              <label>종료</label>
              <input type="date" required min={date} disabled={viewOnly} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <textarea
            rows={2} placeholder="메모 (선택)" disabled={viewOnly}
            value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={200}
          />

          {editing && !viewOnly && (
            <>
              <h4 style={{ margin: '4px 2px 0' }}>
                이 일정에 쓴 돈 {linked.length > 0 && `· 총 ${won(Math.max(linkedTotal, 0))}원`}
              </h4>
              <div className="card">
                {linked.length === 0 && (
                  <div className="empty">아직 연결된 내역이 없어요.<br />지출 입력 시 이 일정을 선택하면 여기 모여요.</div>
                )}
                {linked.map((t) => (
                  <div key={t.id} className="row">
                    <span className="emoji">{categoryEmoji(t.type, t.category)}</span>
                    <span className="grow">
                      <span className="t1">{t.memo || t.category}</span>
                      <span className="t2">{format(new Date(t.date + 'T00:00'), 'M월 d일')} · {t.category}</span>
                    </span>
                    <span className={`money num ${t.type}`}>
                      {t.type === 'expense' ? '-' : '+'}{won(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {viewOnly ? (
            <div className="empty" style={{ padding: '10px 0 2px' }}>
              반복 일정이에요. 수정·삭제는 설정 &gt; 반복 일정에서 할 수 있어요.
            </div>
          ) : (
            <>
              <button className="btn" disabled={busy}>{editing ? '저장' : '추가하기'}</button>
              {editing && <button type="button" className="btn danger" onClick={remove}>일정 삭제</button>}
            </>
          )}
        </form>
    </Sheet>
  )
}
