import { useEffect, useMemo, useState } from 'react';
import {
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { supabase } from '../lib/supabase';
import { useApp } from '../state/AppContext';
import { categoryEmoji, compactWon, won } from '../lib/meta';
import EventHistorySheet from '../components/EventHistorySheet';

const TREND_MONTHS = 6;

export default function StatsView({ monthDate, txs, profiles }) {
  const { profile } = useApp();
  const [history, setHistory] = useState([]); // 보는 달 포함 최근 6개월 거래
  const [pastEvents, setPastEvents] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const monthKey = format(monthDate, 'yyyy-MM');

  useEffect(() => {
    let on = true;
    const from = format(
      startOfMonth(subMonths(monthDate, TREND_MONTHS - 1)),
      'yyyy-MM-dd',
    );
    const to = format(endOfMonth(monthDate), 'yyyy-MM-dd');
    supabase
      .from('transactions')
      .select('date, amount, type, category')
      .eq('couple_id', profile.couple_id)
      .gte('date', from)
      .lte('date', to)
      .then(({ data }) => {
        if (on) setHistory(data || []);
      });
    supabase
      .from('events')
      .select('*')
      .eq('couple_id', profile.couple_id)
      .lte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: false })
      .limit(400)
      .then(({ data }) => {
        if (on) setPastEvents(data || []);
      });
    return () => {
      on = false;
    };
  }, [profile.couple_id, monthKey, txs]); // eslint-disable-line

  const monthTxs = useMemo(
    () =>
      txs.filter((t) => isSameMonth(new Date(t.date + 'T00:00'), monthDate)),
    [txs, monthDate],
  );
  const expense = monthTxs.filter((t) => t.type === 'expense');
  const income = monthTxs.filter((t) => t.type === 'income');
  const totalExpense = expense.reduce((a, t) => a + t.amount, 0);
  const totalIncome = income.reduce((a, t) => a + t.amount, 0);

  const byCategory = useMemo(() => {
    const map = {};
    for (const t of expense)
      map[t.category] = (map[t.category] || 0) + t.amount;
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expense]);

  const byPerson = useMemo(
    () =>
      profiles.map((p) => ({
        ...p,
        sum: expense
          .filter((t) => t.created_by === p.id)
          .reduce((a, t) => a + t.amount, 0),
      })),
    [expense, profiles],
  );

  // 전월 비교 (history 에서 계산)
  const prevMonth = subMonths(monthDate, 1);
  const prevByCategory = useMemo(() => {
    const map = {};
    for (const t of history) {
      if (t.type !== 'expense') continue;
      if (!isSameMonth(new Date(t.date + 'T00:00'), prevMonth)) continue;
      map[t.category] = (map[t.category] || 0) + t.amount;
    }
    return map;
  }, [history, monthKey]); // eslint-disable-line
  const prevTotal = Object.values(prevByCategory).reduce((a, v) => a + v, 0);
  const deltaPct =
    prevTotal > 0
      ? Math.round(((totalExpense - prevTotal) / prevTotal) * 100)
      : null;

  // 최근 6개월 지출 추이
  const trend = useMemo(() => {
    const cols = [];
    for (let i = TREND_MONTHS - 1; i >= 0; i--) {
      const m = subMonths(monthDate, i);
      const sum = history
        .filter(
          (t) =>
            t.type === 'expense' && isSameMonth(new Date(t.date + 'T00:00'), m),
        )
        .reduce((a, t) => a + t.amount, 0);
      cols.push({
        key: format(m, 'yyyy-MM'),
        label: format(m, 'M월'),
        sum,
        current: i === 0,
      });
    }
    const max = Math.max(...cols.map((c) => c.sum), 1);
    return cols.map((c) => ({
      ...c,
      pct: c.sum > 0 ? Math.max((c.sum / max) * 100, 3) : 0,
    }));
  }, [history, monthKey]); // eslint-disable-line

  // 월간 한 줄 요약
  const biggest = expense.reduce(
    (a, t) => (!a || t.amount > a.amount ? t : a),
    null,
  );
  const topCat = byCategory[0];

  const categoryDelta = (cat, sum) => {
    const prev = prevByCategory[cat];
    if (!prev) return null;
    return Math.round(((sum - prev) / prev) * 100);
  };

  return (
    <div className="stats">
      <div className="card" style={{ marginBottom: 20 }}>
        {pastEvents.length === 0 && (
          <div className="empty">아직 함께한 일정 기록이 없어요</div>
        )}
        {pastEvents.slice(0, 2).map((ev) => (
          <div className="row" key={ev.id}>
            <span className="hist-date num">
              {format(new Date(ev.starts_at), 'M.d')}
            </span>
            <span
              className="who"
              style={{
                background:
                  profiles.find((p) => p.id === ev.created_by)?.color ||
                  '#9aa1ab',
              }}
            />
            <span className="grow">
              <span className="t1">{ev.title}</span>
              {ev.memo && <span className="t2">{ev.memo}</span>}
            </span>
          </div>
        ))}
        {pastEvents.length > 0 && (
          <button className="row" onClick={() => setShowHistory(true)}>
            <span
              className="grow"
              style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}
            >
              전체 {pastEvents.length}개 모아 보기
            </span>
            <span className="t2">›</span>
          </button>
        )}
      </div>

      <hr className="stats-divider" />

      <div className="stat-cards">
        <div className="stat-card">
          <div className="k">이번 달 지출</div>
          <div className="v num" style={{ color: 'var(--expense)' }}>
            {won(totalExpense)}원
          </div>
          {deltaPct !== null && (
            <div className={`delta num ${deltaPct > 0 ? 'up' : 'down'}`}>
              지난달보다 {deltaPct > 0 ? '+' : ''}
              {deltaPct}%
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="k">이번 달 수입</div>
          <div className="v num" style={{ color: 'var(--income)' }}>
            {won(totalIncome)}원
          </div>
        </div>
      </div>

      {totalExpense > 0 && topCat && biggest && (
        <>
          <h4>이번 달 이야기</h4>
          <div className="card recap">
            <p>
              이번 달 우리는{' '}
              <b>
                {categoryEmoji('expense', topCat[0])} {topCat[0]}
              </b>
              에 가장 많이 썼어요.
            </p>
            <p>
              가장 큰 지출은{' '}
              {format(new Date(biggest.date + 'T00:00'), 'M월 d일')}{' '}
              <b>{biggest.memo || biggest.category}</b>,{' '}
              <b className="num">{won(biggest.amount)}원</b>.
            </p>
            {deltaPct !== null && (
              <p>
                지난달보다 지출이{' '}
                <b className={deltaPct > 0 ? 'neg' : 'pos'}>
                  {Math.abs(deltaPct)}%{' '}
                  {deltaPct > 0
                    ? '늘었어요'
                    : deltaPct < 0
                      ? '줄었어요'
                      : '비슷해요'}
                </b>
                .
              </p>
            )}
          </div>
        </>
      )}

      <h4>최근 6개월 지출</h4>
      <div className="card">
        <div className="trend" role="img" aria-label="최근 6개월 지출 추이">
          {trend.map((m) => (
            <div key={m.key} className={`trend-col ${m.current ? 'on' : ''}`}>
              <span className="tv num">
                {m.sum > 0 ? compactWon(m.sum) : ''}
              </span>
              <span className="tbar">
                <span className="tb" style={{ height: `${m.pct}%` }} />
              </span>
              <span className="tl num">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <h4>누가 썼을까</h4>
      <div className="card" style={{ marginBottom: 14 }}>
        {totalExpense === 0 ? (
          <div className="empty">이번 달 지출이 아직 없어요</div>
        ) : (
          <>
            <div className="split-bar" role="img" aria-label="지출 비율">
              {byPerson.map((p) => (
                <span
                  key={p.id}
                  style={{
                    width: `${(p.sum / totalExpense) * 100}%`,
                    background: p.color,
                  }}
                />
              ))}
            </div>
            <div className="split-legend">
              {byPerson.map((p) => (
                <span key={p.id}>
                  <span
                    className="legend-dot"
                    style={{ background: p.color }}
                  />
                  {p.display_name} <b className="num">{won(p.sum)}원</b>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <h4>분류별 지출</h4>
      <div className="card" style={{ marginBottom: 14 }}>
        {byCategory.length === 0 && (
          <div className="empty">지출을 기록하면 분류별 통계가 보여요</div>
        )}
        {byCategory.map(([cat, sum]) => {
          const d = categoryDelta(cat, sum);
          return (
            <div className="bar-row" key={cat}>
              <div className="bar-head">
                <span>
                  {categoryEmoji('expense', cat)} {cat}
                  <span className="pct num">
                    {Math.round((sum / totalExpense) * 100)}%
                  </span>
                  {d !== null && d !== 0 && (
                    <span className={`delta num ${d > 0 ? 'up' : 'down'}`}>
                      {d > 0 ? '▲' : '▼'}
                      {Math.abs(d)}%
                    </span>
                  )}
                </span>
                <span className="num">{won(sum)}원</span>
              </div>
              <div className="bar-track">
                <span
                  className="bar-fill"
                  style={{
                    width: `${(sum / totalExpense) * 100}%`,
                    background: 'var(--ink)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {showHistory && (
        <EventHistorySheet
          events={pastEvents}
          profiles={profiles}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
