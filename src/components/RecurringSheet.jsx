import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../state/AppContext'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, categoryEmoji, won } from '../lib/meta'
import { LAST_DAY, ruleDayLabel, runRecurringRules } from '../lib/recurrence'
import Sheet from './Sheet'

export default function RecurringSheet({ onClose }) {
  const { profile, guard } = useApp()
  const [rules, setRules] = useState(null)
  const [editing, setEditing] = useState(null) // null=목록, {}=새 규칙, {...rule}=수정

  const load = async () => {
    const { data } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('couple_id', profile.couple_id)
      .order('created_at')
    setRules(data || [])
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  const afterChange = async () => {
    await load()
    await runRecurringRules(profile.couple_id)
    setEditing(null)
  }

  const toggleActive = async (rule) => {
    const { ok } = await guard(async () => {
      const { error } = await supabase
        .from('recurring_rules')
        .update({ active: !rule.active })
        .eq('id', rule.id)
      if (error) throw error
    })
    if (ok) afterChange()
  }

  return (
    <Sheet onClose={onClose} label="반복 일정">
        <div className="sheet-head">
          <span className="sheet-title">반복 일정</span>
          {!editing && (
            <button className="today-btn" onClick={() => setEditing({})}>+ 새 규칙</button>
          )}
        </div>

        {editing ? (
          <RuleForm
            initial={editing.id ? editing : null}
            onCancel={() => setEditing(null)}
            onSaved={afterChange}
          />
        ) : (
          <div className="card">
            {rules === null && <div className="empty">불러오는 중…</div>}
            {rules?.length === 0 && (
              <div className="empty">
                매달 반복되는 내역을 등록해보세요.<br />
                날짜가 되면 가계부에 자동으로 들어가요.
              </div>
            )}
            {rules?.map((r) => (
              <div className="row" key={r.id} style={{ opacity: r.active ? 1 : 0.45 }}>
                <button className="emoji" onClick={() => setEditing(r)} aria-label="규칙 수정">
                  {categoryEmoji(r.type, r.category)}
                </button>
                <button className="grow" style={{ textAlign: 'left' }} onClick={() => setEditing(r)}>
                  <span className="t1">{r.memo || r.category}</span>
                  <span className="t2">
                    {ruleDayLabel(r.day_of_month)} · <span className={`num ${r.type}`} style={{ color: `var(--${r.type})` }}>
                      {r.type === 'expense' ? '-' : '+'}{won(r.amount)}원
                    </span>
                  </span>
                </button>
                <button
                  className={`toggle ${r.active ? 'on' : ''}`}
                  onClick={() => toggleActive(r)}
                  aria-label={r.active ? '반복 끄기' : '반복 켜기'}
                  role="switch"
                  aria-checked={r.active}
                />
              </div>
            ))}
          </div>
        )}
    </Sheet>
  )
}

function RuleForm({ initial, onCancel, onSaved }) {
  const { profile, guard, toast } = useApp()
  const editing = Boolean(initial)
  const [type, setType] = useState(initial?.type || 'expense')
  const [amountStr, setAmountStr] = useState(initial ? String(initial.amount) : '')
  const [category, setCategory] = useState(initial?.category || '데이트')
  const [memo, setMemo] = useState(initial?.memo || '')
  const [day, setDay] = useState(initial?.day_of_month || LAST_DAY)
  const [busy, setBusy] = useState(false)

  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const amount = parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0

  const switchType = (t) => {
    setType(t)
    const list = t === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    if (!list.some((c) => c.name === category)) setCategory(list[0].name)
  }

  const save = async (e) => {
    e.preventDefault()
    if (amount <= 0) { toast('금액을 입력해주세요.'); return }
    setBusy(true)
    const payload = {
      couple_id: profile.couple_id,
      type, amount, category,
      memo: memo.trim(),
      day_of_month: Number(day),
    }
    const { ok } = await guard(async () => {
      if (editing) {
        const { error } = await supabase.from('recurring_rules').update(payload).eq('id', initial.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('recurring_rules').insert({ ...payload, created_by: profile.id })
        if (error) throw error
      }
    })
    setBusy(false)
    if (ok) { toast(editing ? '규칙을 수정했어요.' : '반복 일정을 등록했어요.'); onSaved() }
  }

  const remove = async () => {
    if (!confirm('이 규칙을 삭제할까요? 이미 만들어진 내역은 그대로 남아요.')) return
    const { ok } = await guard(async () => {
      const { error } = await supabase.from('recurring_rules').delete().eq('id', initial.id)
      if (error) throw error
    })
    if (ok) { toast('규칙을 삭제했어요.'); onSaved() }
  }

  return (
    <form className="form" onSubmit={save}>
      <div className="seg" role="tablist">
        <button type="button" className={type === 'expense' ? 'on expense' : ''} onClick={() => switchType('expense')}>지출</button>
        <button type="button" className={type === 'income' ? 'on income' : ''} onClick={() => switchType('income')}>수입</button>
      </div>
      <div className="amount-input">
        <input
          inputMode="numeric" placeholder="0" required autoFocus={!editing}
          value={amount ? won(amount) : ''}
          onChange={(e) => setAmountStr(e.target.value)}
          aria-label="금액"
        />
      </div>
      <div>
        <label>분류</label>
        <div className="cat-grid">
          {cats.map((c) => (
            <button
              key={c.name} type="button"
              className={category === c.name ? 'on' : ''}
              onClick={() => setCategory(c.name)}
            >
              <span className="e">{c.emoji}</span>{c.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label>매월 언제?</label>
        <select value={day} onChange={(e) => setDay(e.target.value)}>
          {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>매월 {d}일</option>
          ))}
          <option value={LAST_DAY}>매월 말일</option>
        </select>
        {Number(day) >= 29 && Number(day) !== LAST_DAY && (
          <p className="hint">날짜가 없는 달엔 말일에 들어가요.</p>
        )}
      </div>
      <input
        placeholder="메모 (예: 데이트 통장 입금)" value={memo}
        onChange={(e) => setMemo(e.target.value)} maxLength={60}
      />
      <button className="btn" disabled={busy}>{editing ? '저장' : '등록하기'}</button>
      <div className="form-row">
        <button type="button" className="btn ghost" onClick={onCancel}>목록으로</button>
        {editing && <button type="button" className="btn danger" onClick={remove}>규칙 삭제</button>}
      </div>
    </form>
  )
}
