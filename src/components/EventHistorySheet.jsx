import { useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import Sheet from './Sheet';

// 지나온 일정을 달 단위로 묶어 보여주는 기록 시트
export default function EventHistorySheet({ events, profiles, onClose }) {
  const colorOf = (id) => profiles.find((p) => p.id === id)?.color || '#9aa1ab';

  const groups = useMemo(() => {
    const out = [];
    let cur = null;
    for (const ev of events) {
      const key = format(new Date(ev.starts_at), 'yyyy년 M월');
      if (!cur || cur.key !== key) {
        cur = { key, items: [] };
        out.push(cur);
      }
      cur.items.push(ev);
    }
    return out;
  }, [events]);

  return (
    <Sheet onClose={onClose} label="우리의 일정 기록">
      <div className="sheet-head">
        <span className="sheet-title">📦</span>
        <span className="t2" style={{ fontSize: 12, color: 'var(--muted)' }}>
          총 {events.length}개
        </span>
      </div>

      {events.length === 0 && (
        <div className="card">
          <div className="empty">아직 함께한 일정이 없어요</div>
        </div>
      )}
      {groups.map((g) => (
        <div key={g.key}>
          <h4>
            {g.key}{' '}
            <span style={{ fontWeight: 600 }}>· {g.items.length}개</span>
          </h4>
          <div className="card">
            {g.items.map((ev) => (
              <div className="row" key={ev.id}>
                <span className="hist-date num">
                  {format(new Date(ev.starts_at), 'd일')}
                </span>
                <span
                  className="who"
                  style={{ background: colorOf(ev.created_by) }}
                />
                <span className="grow">
                  <span className="t1">{ev.title}</span>
                  <span className="t2">
                    {format(new Date(ev.starts_at), 'EEEE', { locale: ko })}
                    {ev.memo && ` · ${ev.memo}`}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  );
}
