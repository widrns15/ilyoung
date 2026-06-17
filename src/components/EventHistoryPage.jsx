import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// 지나온 일정을 달 단위로 묶어 보여주는 전체 화면 페이지
export default function EventHistoryPage({ events, profiles, onClose }) {
  const colorOf = (id) => profiles.find((p) => p.id === id)?.color || '#9aa1ab';
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const toggleSearch = () => {
    setSearchOpen((o) => {
      if (o) setQuery('');
      return !o;
    });
  };

  // 안드로이드 뒤로가기로 닫기
  useEffect(() => {
    window.history.pushState({ page: 'event-history' }, '');
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => {
    if (window.history.state?.page === 'event-history') window.history.back();
    else onClose();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.memo || '').toLowerCase().includes(q),
    );
  }, [events, query]);

  const groups = useMemo(() => {
    const out = [];
    let cur = null;
    for (const ev of filtered) {
      const key = format(new Date(ev.starts_at), 'yyyy년 M월');
      if (!cur || cur.key !== key) {
        cur = { key, items: [] };
        out.push(cur);
      }
      cur.items.push(ev);
    }
    return out;
  }, [filtered]);

  return (
    <div className="page" role="dialog" aria-label="📦">
      <header className="page-header">
        <button className="icon-btn" onClick={back} aria-label="뒤로">
          ‹
        </button>
        {!searchOpen && <span className="page-title">📦</span>}
        <div className={`search-box ${searchOpen ? 'open' : ''}`}>
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            placeholder="제목 · 메모 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="icon-btn"
            onClick={toggleSearch}
            aria-label={searchOpen ? '검색 닫기' : '검색'}
          >
            {searchOpen ? '✕' : '🔍'}
          </button>
        </div>
      </header>

      <div className="page-body">
        <div className="page-count">
          {query.trim() ? `${filtered.length}개 찾음` : `총 ${events.length}개`}
        </div>
        {events.length === 0 && (
          <div className="card">
            <div className="empty">아직 함께한 일정이 없어요</div>
          </div>
        )}
        {events.length > 0 && filtered.length === 0 && (
          <div className="card">
            <div className="empty">‘{query.trim()}’에 맞는 일정이 없어요</div>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.key}>
            <h4>{g.key}</h4>
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
      </div>
    </div>
  );
}
