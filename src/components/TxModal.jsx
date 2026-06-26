import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useApp } from '../state/AppContext';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, won } from '../lib/meta';
import { notifyPartner } from '../lib/push';
import Sheet from './Sheet';

export default function TxModal({
  initial,
  defaultDay,
  events,
  onClose,
  onSaved,
}) {
  const { profile, guard, toast } = useApp();
  const editing = Boolean(initial);
  const viewOnly = Boolean(initial?.virtual); // 반복 거래(예정) — 읽기 전용
  const [type, setType] = useState(initial?.type || 'expense');
  const [amountStr, setAmountStr] = useState(
    initial ? String(initial.amount) : '',
  );
  const [category, setCategory] = useState(initial?.category || '데이트');
  const [memo, setMemo] = useState(initial?.memo || '');
  const [date, setDate] = useState(
    initial?.date || format(defaultDay, 'yyyy-MM-dd'),
  );
  const [eventId, setEventId] = useState(initial?.event_id || '');
  const [busy, setBusy] = useState(false);

  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const amount = parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0;

  // 선택한 날짜에 걸친 일정만 연결 후보로
  const candidateEvents = useMemo(() => {
    const d0 = new Date(`${date}T00:00:00`);
    const d1 = new Date(d0);
    d1.setDate(d1.getDate() + 1);
    return events.filter(
      (ev) => new Date(ev.starts_at) < d1 && new Date(ev.ends_at) >= d0,
    );
  }, [events, date]);

  const switchType = (t) => {
    setType(t);
    // 수입은 분류 없음 → '기타' 고정, 지출은 목록에 없으면 첫 분류로
    if (t === 'income') setCategory('기타');
    else if (!EXPENSE_CATEGORIES.some((c) => c.name === category)) {
      setCategory(EXPENSE_CATEGORIES[0].name);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (amount <= 0) {
      toast('금액을 입력해주세요.');
      return;
    }
    setBusy(true);
    const payload = {
      couple_id: profile.couple_id,
      type,
      amount,
      category,
      memo: memo.trim(),
      date,
      event_id: eventId || null,
    };
    const { ok } = await guard(async () => {
      if (editing) {
        const { error } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('transactions')
          .insert({ ...payload, created_by: profile.id });
        if (error) throw error;
      }
    });
    setBusy(false);
    if (ok) {
      if (!editing) {
        const sign = type === 'expense' ? '-' : '+';
        notifyPartner({
          title: `${profile.display_name}님이 ${type === 'expense' ? '지출' : '수입'}을 기록했어요`,
          body: `${category} ${sign}${won(amount)}원`,
        });
      }
      toast(editing ? '내역을 수정했어요.' : '내역을 추가했어요.');
      onSaved();
      onClose();
    }
  };

  const remove = async () => {
    if (!confirm('이 내역을 삭제할까요?')) return;
    const { ok } = await guard(async () => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', initial.id);
      if (error) throw error;
    });
    if (ok) {
      toast('내역을 삭제했어요.');
      onSaved();
      onClose();
    }
  };

  return (
    <Sheet
      onClose={onClose}
      label={viewOnly ? '반복 거래' : editing ? '내역 수정' : '내역 추가'}
    >
      <div className="sheet-head">
        <span className="sheet-title">
          {viewOnly ? '🔁 반복 거래' : editing ? '내역 수정' : '새 내역'}
        </span>
      </div>
      <form className="form" onSubmit={save}>
        <div className="seg" role="tablist">
          <button
            type="button"
            disabled={viewOnly}
            className={type === 'expense' ? 'on expense' : ''}
            onClick={() => switchType('expense')}
          >
            지출
          </button>
          <button
            type="button"
            disabled={viewOnly}
            className={type === 'income' ? 'on income' : ''}
            onClick={() => switchType('income')}
          >
            수입
          </button>
        </div>
        <div className="amount-input">
          <input
            inputMode="numeric"
            placeholder="0"
            required
            autoFocus={!editing}
            disabled={viewOnly}
            value={amount ? won(amount) : ''}
            onChange={(e) => setAmountStr(e.target.value)}
            aria-label="금액"
          />
        </div>
        {type === 'expense' && (
          <div>
            <label>분류</label>
            <div className="cat-grid">
              {cats.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  disabled={viewOnly}
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
        <div className="form-row">
          <div>
            <label>날짜</label>
            <input
              type="date"
              required
              disabled={viewOnly}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setEventId('');
              }}
            />
          </div>
          <div>
            <label>일정 연결</label>
            <select
              value={eventId}
              disabled={viewOnly}
              onChange={(e) => setEventId(e.target.value)}
            >
              <option value="">연결 안 함</option>
              {candidateEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <input
          placeholder="메모 (예: 성수동 파스타)"
          value={memo}
          disabled={viewOnly}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={60}
        />
        {viewOnly ? (
          <div className="empty" style={{ padding: '10px 0 2px' }}>
            수정·삭제는 설정 &gt; 반복 일정에서 할 수 있어요.
          </div>
        ) : (
          <>
            <button className="btn" disabled={busy}>
              {editing ? '저장' : '추가하기'}
            </button>
            {editing && (
              <button type="button" className="btn danger" onClick={remove}>
                내역 삭제
              </button>
            )}
          </>
        )}
      </form>
    </Sheet>
  );
}
