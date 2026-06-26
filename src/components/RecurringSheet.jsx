import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../state/AppContext';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  categoryEmoji,
  won,
} from '../lib/meta';
import { LAST_DAY, ruleDayLabel, runRecurringRules } from '../lib/recurrence';
import Sheet from './Sheet';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

function ruleWhenLabel(rule) {
  if (rule._kind === 'event') {
    return rule.freq === 'yearly'
      ? `매년 ${rule.month}월 ${rule.day}일`
      : ruleDayLabel(rule.day);
  }
  return ruleDayLabel(rule.day_of_month);
}

export default function RecurringSheet({ onClose }) {
  const { profile, guard } = useApp();
  const [rules, setRules] = useState(null); // 거래 규칙 + 일정 규칙 (_kind 로 구분)
  const [editing, setEditing] = useState(null); // null=목록, {}=새 규칙, {...rule}=수정

  const load = async () => {
    const [tx, ev] = await Promise.all([
      supabase
        .from('recurring_rules')
        .select('*')
        .eq('couple_id', profile.couple_id)
        .order('created_at'),
      supabase
        .from('recurring_events')
        .select('*')
        .eq('couple_id', profile.couple_id)
        .order('created_at'),
    ]);
    setRules(
      [
        ...(tx.data || []).map((r) => ({ ...r, _kind: 'tx' })),
        ...(ev.data || []).map((r) => ({ ...r, _kind: 'event' })),
      ].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const afterChange = async () => {
    await load();
    await runRecurringRules(profile.couple_id);
    setEditing(null);
  };

  const toggleActive = async (rule) => {
    const table =
      rule._kind === 'event' ? 'recurring_events' : 'recurring_rules';
    const { ok } = await guard(async () => {
      const { error } = await supabase
        .from(table)
        .update({ active: !rule.active })
        .eq('id', rule.id);
      if (error) throw error;
    });
    if (ok) afterChange();
  };

  return (
    <Sheet onClose={onClose} label="반복 일정">
      <div className="sheet-head">
        <span className="sheet-title">반복 일정</span>
        {!editing && (
          <button className="today-btn" onClick={() => setEditing({})}>
            + 새 규칙
          </button>
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
              매달 반복되는 입출금이나 매년 돌아오는 날(생일 등)을 등록해보세요.
              <br />
              가계부와 캘린더에 자동으로 반영돼요.
            </div>
          )}
          {rules?.map((r) => (
            <div
              className="row"
              key={`${r._kind}-${r.id}`}
              style={{ opacity: r.active ? 1 : 0.45 }}
            >
              <button
                className="emoji"
                onClick={() => setEditing(r)}
                aria-label="규칙 수정"
              >
                {r._kind === 'event' ? '🎂' : categoryEmoji(r.type, r.category)}
              </button>
              <button
                className="grow"
                style={{ textAlign: 'left' }}
                onClick={() => setEditing(r)}
              >
                <span className="t1">
                  {r._kind === 'event' ? r.title : r.memo || r.category}
                </span>
                <span className="t2">
                  {ruleWhenLabel(r)}
                  {r._kind === 'tx' && (
                    <>
                      {' '}
                      ·{' '}
                      <span
                        className="num"
                        style={{ color: `var(--${r.type})` }}
                      >
                        {r.type === 'expense' ? '-' : '+'}
                        {won(r.amount)}원
                      </span>
                    </>
                  )}
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
  );
}

function RuleForm({ initial, onCancel, onSaved }) {
  const { profile, guard, toast } = useApp();
  const editing = Boolean(initial);
  // kind: expense | income | event
  const [kind, setKind] = useState(
    initial?._kind === 'event' ? 'event' : initial?.type || 'expense',
  );
  const isEvent = kind === 'event';

  // 거래 규칙 필드
  const [amountStr, setAmountStr] = useState(
    initial?.amount ? String(initial.amount) : '',
  );
  const [category, setCategory] = useState(initial?.category || '데이트');
  const [memo, setMemo] = useState(initial?.memo || '');
  const [day, setDay] = useState(initial?.day_of_month || LAST_DAY);

  // 일정 규칙 필드
  const today = new Date();
  const [title, setTitle] = useState(initial?.title || '');
  const [freq, setFreq] = useState(initial?.freq || 'yearly');
  const [evMonth, setEvMonth] = useState(
    initial?.month || today.getMonth() + 1,
  );
  const [evDay, setEvDay] = useState(
    initial?._kind === 'event' ? initial.day : today.getDate(),
  );

  const [busy, setBusy] = useState(false);

  const cats = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const amount = parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0;

  const switchKind = (k) => {
    setKind(k);
    // 수입은 분류 없음 → '기타' 고정, 지출은 목록에 없으면 첫 분류로
    if (k === 'income') setCategory('기타');
    else if (k === 'expense' && !EXPENSE_CATEGORIES.some((c) => c.name === category)) {
      setCategory(EXPENSE_CATEGORIES[0].name);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { ok } = await guard(async () => {
      if (isEvent) {
        const payload = {
          couple_id: profile.couple_id,
          title: title.trim(),
          freq,
          month: freq === 'yearly' ? Number(evMonth) : null,
          day: Number(evDay),
        };
        if (editing) {
          const { error } = await supabase
            .from('recurring_events')
            .update(payload)
            .eq('id', initial.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('recurring_events')
            .insert({ ...payload, created_by: profile.id });
          if (error) throw error;
        }
      } else {
        if (amount <= 0) throw new Error('금액을 입력해주세요.');
        const payload = {
          couple_id: profile.couple_id,
          type: kind,
          amount,
          category,
          memo: memo.trim(),
          day_of_month: Number(day),
        };
        if (editing) {
          const { error } = await supabase
            .from('recurring_rules')
            .update(payload)
            .eq('id', initial.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('recurring_rules')
            .insert({ ...payload, created_by: profile.id });
          if (error) throw error;
        }
      }
    });
    setBusy(false);
    if (ok) {
      toast(editing ? '규칙을 수정했어요.' : '반복 일정을 등록했어요.');
      onSaved();
    }
  };

  const remove = async () => {
    const msg =
      initial._kind === 'event'
        ? '이 반복 일정을 삭제할까요? 캘린더에서 사라져요.'
        : '이 규칙을 삭제할까요? 이미 만들어진 내역은 그대로 남아요.';
    if (!confirm(msg)) return;
    const table =
      initial._kind === 'event' ? 'recurring_events' : 'recurring_rules';
    const { ok } = await guard(async () => {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', initial.id);
      if (error) throw error;
    });
    if (ok) {
      toast('규칙을 삭제했어요.');
      onSaved();
    }
  };

  return (
    <form className="form" onSubmit={save}>
      {/* 수정 시에는 종류 전환 불가 (저장 테이블이 달라짐) */}
      {!editing ? (
        <div className="seg" role="tablist">
          <button
            type="button"
            className={kind === 'expense' ? 'on expense' : ''}
            onClick={() => switchKind('expense')}
          >
            지출
          </button>
          <button
            type="button"
            className={kind === 'income' ? 'on income' : ''}
            onClick={() => switchKind('income')}
          >
            수입
          </button>
          <button
            type="button"
            className={kind === 'event' ? 'on' : ''}
            onClick={() => switchKind('event')}
          >
            일정
          </button>
        </div>
      ) : (
        !isEvent && (
          <div className="seg" role="tablist">
            <button
              type="button"
              className={kind === 'expense' ? 'on expense' : ''}
              onClick={() => switchKind('expense')}
            >
              지출
            </button>
            <button
              type="button"
              className={kind === 'income' ? 'on income' : ''}
              onClick={() => switchKind('income')}
            >
              수입
            </button>
          </div>
        )
      )}

      {isEvent ? (
        <>
          <input
            placeholder="무슨 날인가요? (예: 주인님 생일)"
            required
            autoFocus={!editing}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={40}
          />
          <div>
            <label>반복 주기</label>
            <div className="seg">
              <button
                type="button"
                className={freq === 'yearly' ? 'on' : ''}
                onClick={() => setFreq('yearly')}
              >
                매년
              </button>
              <button
                type="button"
                className={freq === 'monthly' ? 'on' : ''}
                onClick={() => setFreq('monthly')}
              >
                매월
              </button>
            </div>
          </div>
          <div className="form-row">
            {freq === 'yearly' && (
              <div>
                <label>월</label>
                <select
                  value={evMonth}
                  onChange={(e) => setEvMonth(e.target.value)}
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}월
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label>일</label>
              <select value={evDay} onChange={(e) => setEvDay(e.target.value)}>
                {(freq === 'yearly' ? [...DAYS, 31] : DAYS).map((d) => (
                  <option key={d} value={d}>
                    {d}일
                  </option>
                ))}
                {freq === 'monthly' && <option value={LAST_DAY}>말일</option>}
              </select>
            </div>
          </div>
          {Number(evDay) >= 29 && (
            <p className="hint">날짜가 없는 달(해)엔 말일로 표시돼요.</p>
          )}
        </>
      ) : (
        <>
          <div className="amount-input">
            <input
              inputMode="numeric"
              placeholder="0"
              required
              autoFocus={!editing}
              value={amount ? won(amount) : ''}
              onChange={(e) => setAmountStr(e.target.value)}
              aria-label="금액"
            />
          </div>
          {kind === 'expense' && (
            <div>
              <label>분류</label>
              <div className="cat-grid">
                {cats.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className={category === c.name ? 'on' : ''}
                    onClick={() => setCategory(c.name)}
                  >
                    <span className="e">{c.emoji}</span>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label>매월 언제?</label>
            <select value={day} onChange={(e) => setDay(e.target.value)}>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  매월 {d}일
                </option>
              ))}
              <option value={LAST_DAY}>매월 말일</option>
            </select>
            {Number(day) >= 29 && Number(day) !== LAST_DAY && (
              <p className="hint">날짜가 없는 달엔 말일에 들어가요.</p>
            )}
          </div>
          <input
            placeholder="메모 (예: 데이트 통장 입금)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={60}
          />
        </>
      )}

      <button className="btn" disabled={busy}>
        {editing ? '저장' : '등록하기'}
      </button>
      <div className="form-row">
        <button type="button" className="btn ghost" onClick={onCancel}>
          목록으로
        </button>
        {editing && (
          <button type="button" className="btn danger" onClick={remove}>
            규칙 삭제
          </button>
        )}
      </div>
    </form>
  );
}
