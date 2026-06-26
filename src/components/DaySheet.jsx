import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { categoryEmoji, won } from '../lib/meta';
import { previewTxForDay } from '../lib/recurrence';
import Sheet from './Sheet';

const LONG_PRESS_MS = 300;

export default function DaySheet({
  day,
  events,
  txs,
  profiles,
  onClose,
  onAddEvent,
  onAddTx,
  onEditEvent,
  onEditTx,
  onReorderEvents,
  rules = [],
}) {
  const key = format(day, 'yyyy-MM-dd');
  const dayEvents = events.filter((ev) => {
    const s = new Date(ev.starts_at);
    const e = new Date(ev.ends_at);
    const d0 = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const d1 = new Date(d0);
    d1.setDate(d1.getDate() + 1);
    return s < d1 && e >= d0;
  });
  const dayTxs = txs.filter((t) => t.date === key);
  const txPreviews = previewTxForDay(rules, day, dayTxs); // 아직 생성 안 된 예정 반복 거래
  const expense = dayTxs
    .filter((t) => t.type === 'expense')
    .reduce((a, t) => a + t.amount, 0);
  const income = dayTxs
    .filter((t) => t.type === 'income')
    .reduce((a, t) => a + t.amount, 0);
  const nameOf = (id) => profiles.find((p) => p.id === id)?.display_name || '';
  const colorOf = (id) => profiles.find((p) => p.id === id)?.color || '#9aa1ab';

  // ----- 일정 꾹 눌러 위아래로 순서 변경 -----
  const eventsSig = dayEvents.map((e) => e.id).join('|');
  const [items, setItems] = useState(dayEvents);
  const [dragId, setDragId] = useState(null);
  const listRef = useRef(null);
  const press = useRef(null); // { ev, y, id, el, timer, dragging }

  useEffect(() => {
    setItems(dayEvents);
  }, [eventsSig]); // eslint-disable-line react-hooks/exhaustive-deps

  // 드래그 중 시트 스크롤 차단
  useEffect(() => {
    if (!dragId) return;
    const prevent = (e) => e.preventDefault();
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => document.removeEventListener('touchmove', prevent);
  }, [dragId]);

  const canReorder = items.filter((x) => !x.virtual).length > 1;

  const rowDown = (e, ev) => {
    if (e.button) return;
    const el = e.currentTarget;
    const p = { ev, y: e.clientY, id: e.pointerId, el, dragging: false };
    p.timer = setTimeout(() => {
      // 가상(반복) 일정은 실제 행이 없어 순서 변경 불가 — 탭 편집만 허용
      if (ev.virtual || !canReorder) return;
      try {
        el.setPointerCapture(p.id);
      } catch {
        /* noop */
      }
      p.dragging = true;
      navigator.vibrate?.(10);
      setDragId(ev.id);
    }, LONG_PRESS_MS);
    press.current = p;
  };

  const rowMove = (e) => {
    const p = press.current;
    if (!p) return;
    if (!p.dragging) {
      if (Math.abs(e.clientY - p.y) > 8) {
        clearTimeout(p.timer);
        press.current = null;
      }
      return;
    }
    const rows = listRef.current
      ? [...listRef.current.querySelectorAll('[data-row]')]
      : [];
    const over = rows.find((r) => {
      const b = r.getBoundingClientRect();
      return e.clientY >= b.top && e.clientY <= b.bottom;
    });
    if (!over) return;
    const overId = over.dataset.row;
    setItems((prev) => {
      const from = prev.findIndex((x) => x.id === p.ev.id);
      const to = prev.findIndex((x) => x.id === overId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const rowUp = () => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.dragging) {
      setDragId(null);
      onReorderEvents?.(items.filter((x) => !x.virtual));
    } else {
      onEditEvent(p.ev);
    }
  };

  return (
    <Sheet onClose={onClose} label={format(day, 'M월 d일')}>
      <div className="sheet-head">
        <span className="sheet-title">
          {format(day, 'M월 d일 EEEE', { locale: ko })}
        </span>
        <span className="month-summary" style={{ padding: 0 }}>
          {expense > 0 && (
            <span className="val expense num">-{won(expense)}</span>
          )}
          {income > 0 && <span className="val income num">+{won(income)}</span>}
        </span>
      </div>

      <h4>일정 {dayEvents.length > 0 && `${dayEvents.length}`}</h4>
      <div className="card" ref={listRef}>
        {items.length === 0 && (
          <button className="row empty-add" onClick={() => onAddEvent(day)}>
            <span className="grow empty-add-t">
              ＋ 일정을 추가하려면 누르세요
            </span>
          </button>
        )}
        {items.map((ev) => (
          <button
            key={ev.id}
            data-row={ev.id}
            className={`row ${dragId === ev.id ? 'dragging' : ''}`}
            onPointerDown={(e) => rowDown(e, ev)}
            onPointerMove={rowMove}
            onPointerUp={rowUp}
            onPointerCancel={rowUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span
              className="who"
              style={{ background: colorOf(ev.created_by) }}
            />
            <span className="grow">
              <span className="t1">{ev.title}</span>
              <span className="t2">
                {ev.virtual && '🔁 '}
                {ev.all_day
                  ? '하루 종일'
                  : `${format(new Date(ev.starts_at), 'HH:mm')} – ${format(new Date(ev.ends_at), 'HH:mm')}`}
                {' · '}
                {nameOf(ev.created_by)}
              </span>
            </span>
            {canReorder && !ev.virtual ? (
              <span className="grip" aria-hidden>
                ⠿
              </span>
            ) : (
              <span className="t2">›</span>
            )}
          </button>
        ))}
        {items.length > 0 && (
          <button className="row add-row" onClick={() => onAddEvent(day)}>
            <span className="grow add-row-t">＋ 일정 추가</span>
          </button>
        )}
      </div>

      <h4>가계부 {dayTxs.length > 0 && `${dayTxs.length}`}</h4>
      <div className="card">
        {dayTxs.length === 0 && txPreviews.length === 0 && (
          <button className="row empty-add" onClick={() => onAddTx(day)}>
            <span className="grow empty-add-t">
              ＋ 지출·수입을 추가하려면 누르세요
            </span>
          </button>
        )}
        {dayTxs.map((t) => (
          <button key={t.id} className="row" onClick={() => onEditTx(t)}>
            <span className="emoji">{categoryEmoji(t.type, t.category)}</span>
            <span className="grow">
              <span className="t1">{t.memo || t.category}</span>
              <span className="t2">
                {t.recurring_rule_id && '🔁 '}
                {t.category} · {nameOf(t.created_by)}
                <span
                  className="who"
                  style={{
                    background: colorOf(t.created_by),
                    display: 'inline-block',
                    marginLeft: 6,
                    verticalAlign: 'middle',
                  }}
                />
              </span>
            </span>
            <span className={`money num ${t.type}`}>
              {t.type === 'expense' ? '-' : '+'}
              {won(t.amount)}
            </span>
          </button>
        ))}
        {txPreviews.map((t) => (
          <button
            key={t.id}
            className="row planned"
            onClick={() => onEditTx(t)}
          >
            <span className="emoji">{categoryEmoji(t.type, t.category)}</span>
            <span className="grow">
              <span className="t1">{t.memo || t.category}</span>
              <span className="t2">🔁 예정</span>
            </span>
            <span className={`money num ${t.type}`}>
              {t.type === 'expense' ? '-' : '+'}
              {won(t.amount)}
            </span>
          </button>
        ))}
        {(dayTxs.length > 0 || txPreviews.length > 0) && (
          <button className="row add-row" onClick={() => onAddTx(day)}>
            <span className="grow add-row-t">＋ 지출·수입 추가</span>
          </button>
        )}
      </div>
    </Sheet>
  );
}
