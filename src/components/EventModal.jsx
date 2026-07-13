import { useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useApp } from '../state/AppContext';
import { canAutoFocus, categoryEmoji, won } from '../lib/meta';
import { LAST_DAY } from '../lib/recurrence';
import { notifyPartner } from '../lib/push';
import Sheet from './Sheet';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

export default function EventModal({
  initial,
  defaultDay,
  txs,
  onClose,
  onSaved,
}) {
  const { profile, guard, toast } = useApp();
  const editing = Boolean(initial);
  const viewOnly = Boolean(initial?.virtual); // 반복 일정(가상) — 읽기 전용
  const [title, setTitle] = useState(initial?.title || '');
  const [memo, setMemo] = useState(initial?.memo || '');
  const [date, setDate] = useState(
    format(initial ? new Date(initial.starts_at) : defaultDay, 'yyyy-MM-dd'),
  );
  const [endDate, setEndDate] = useState(
    format(initial ? new Date(initial.ends_at) : defaultDay, 'yyyy-MM-dd'),
  );
  // 반복: 'none' | 'monthly' | 'yearly' — 새 일정에서만 선택 가능
  const [repeat, setRepeat] = useState('none');
  const [evMonth, setEvMonth] = useState(defaultDay.getMonth() + 1);
  const [evDay, setEvDay] = useState(defaultDay.getDate());
  const [busy, setBusy] = useState(false);

  const linked = editing ? txs.filter((t) => t.event_id === initial.id) : [];
  const linkedTotal = linked.reduce(
    (a, t) => a + (t.type === 'expense' ? t.amount : -t.amount),
    0,
  );

  const save = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);

    // 반복 일정: recurring_events 규칙으로 저장
    if (!editing && repeat !== 'none') {
      const { ok } = await guard(async () => {
        const { error } = await supabase.from('recurring_events').insert({
          couple_id: profile.couple_id,
          title: title.trim(),
          freq: repeat,
          month: repeat === 'yearly' ? Number(evMonth) : null,
          day: Number(evDay),
          created_by: profile.id,
        });
        if (error) throw error;
      });
      setBusy(false);
      if (ok) {
        const dayLabel =
          repeat === 'monthly' && Number(evDay) === LAST_DAY
            ? '말일'
            : `${evDay}일`;
        const when =
          repeat === 'yearly' ? `${evMonth}월 ${evDay}일` : dayLabel;
        notifyPartner({
          title: `${profile.display_name}님이 반복 일정을 추가했어요`,
          body: `${repeat === 'yearly' ? '매년' : '매월'} ${when} · ${title.trim()}`,
        });
        toast('반복 일정을 추가했어요.');
        onSaved();
        onClose();
      }
      return;
    }

    const starts = new Date(`${date}T00:00:00`);
    const ends = new Date(`${endDate}T23:59:59`);
    if (ends < starts) {
      toast('종료가 시작보다 빠를 수 없어요.');
      setBusy(false);
      return;
    }
    const payload = {
      couple_id: profile.couple_id,
      title: title.trim(),
      memo: memo.trim(),
      all_day: true,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
    };
    const { ok } = await guard(async () => {
      if (editing) {
        const { error } = await supabase
          .from('events')
          .update(payload)
          .eq('id', initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('events')
          .insert({ ...payload, created_by: profile.id });
        if (error) throw error;
      }
    });
    setBusy(false);
    if (ok) {
      if (!editing) {
        // 알림 본문에 일정 날짜를 함께 — 다일이면 기간으로 표시
        const when =
          date === endDate
            ? format(starts, 'M월 d일')
            : `${format(starts, 'M월 d일')} – ${format(ends, 'M월 d일')}`;
        notifyPartner({
          title: `${profile.display_name}님이 일정을 추가했어요`,
          body: `${when} · ${title.trim()}`,
        });
      }
      toast(editing ? '일정을 수정했어요.' : '일정을 추가했어요.');
      onSaved();
      onClose();
    }
  };

  const remove = async () => {
    if (!confirm('이 일정을 삭제할까요? 연결된 가계부 내역은 남아요.')) return;
    const { ok } = await guard(async () => {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', initial.id);
      if (error) throw error;
    });
    if (ok) {
      toast('일정을 삭제했어요.');
      onSaved();
      onClose();
    }
  };

  return (
    <Sheet
      onClose={onClose}
      label={viewOnly ? '반복 일정' : editing ? '일정 수정' : '일정 추가'}
    >
      <div className="sheet-head">
        <span className="sheet-title">
          {viewOnly ? '🔁 반복 일정' : editing ? '일정 수정' : '새 일정'}
        </span>
        {!editing && (
          <span className="repeat-inline">
            <span aria-hidden>🔁</span>
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              aria-label="반복"
            >
              <option value="none">안 함</option>
              <option value="monthly">매월</option>
              <option value="yearly">매년</option>
            </select>
          </span>
        )}
      </div>
      <form className="form" onSubmit={save}>
        <input
          placeholder="집사랑 나들이 갈까요?"
          required
          autoFocus={!editing && canAutoFocus()}
          disabled={viewOnly}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={40}
        />
        {repeat === 'none' ? (
          <div className="form-row">
            <div>
              <label>시작</label>
              <input
                type="date"
                required
                disabled={viewOnly}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
              />
            </div>
            <div>
              <label>종료</label>
              <input
                type="date"
                required
                min={date}
                disabled={viewOnly}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="form-row">
              {repeat === 'yearly' && (
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
                <select
                  value={evDay}
                  onChange={(e) => setEvDay(e.target.value)}
                >
                  {(repeat === 'yearly' ? [...DAYS, 31] : DAYS).map((d) => (
                    <option key={d} value={d}>
                      {d}일
                    </option>
                  ))}
                  {repeat === 'monthly' && (
                    <option value={LAST_DAY}>말일</option>
                  )}
                </select>
              </div>
            </div>
            {Number(evDay) >= 29 && (
              <p className="hint">날짜가 없는 달(해)엔 말일로 표시돼요.</p>
            )}
          </>
        )}
        {repeat === 'none' && (
          <textarea
            rows={2}
            placeholder="메모 (선택)"
            disabled={viewOnly}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={200}
          />
        )}

        {editing && !viewOnly && (
          <>
            <h4 style={{ margin: '4px 2px 0' }}>
              이 일정에 쓴 돈{' '}
              {linked.length > 0 && `· 총 ${won(Math.max(linkedTotal, 0))}원`}
            </h4>
            <div className="card">
              {linked.length === 0 && (
                <div className="empty">
                  아직 연결된 내역이 없어요.
                  <br />
                  지출 입력 시 이 일정을 선택하면 여기 모여요.
                </div>
              )}
              {linked.map((t) => (
                <div key={t.id} className="row">
                  <span className="emoji">
                    {categoryEmoji(t.type, t.category)}
                  </span>
                  <span className="grow">
                    <span className="t1">{t.memo || t.category}</span>
                    <span className="t2">
                      {format(new Date(t.date + 'T00:00'), 'M월 d일')} ·{' '}
                      {t.category}
                    </span>
                  </span>
                  <span className={`money num ${t.type}`}>
                    {t.type === 'expense' ? '-' : '+'}
                    {won(t.amount)}
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
            <button className="btn" disabled={busy}>
              {editing ? '저장' : '추가하기'}
            </button>
            {editing && (
              <button type="button" className="btn danger" onClick={remove}>
                일정 삭제
              </button>
            )}
          </>
        )}
      </form>
    </Sheet>
  );
}
