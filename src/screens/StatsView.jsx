import { useMemo } from 'react'
import { isSameMonth } from 'date-fns'
import { categoryEmoji, won } from '../lib/meta'

export default function StatsView({ monthDate, txs, profiles }) {
  const monthTxs = useMemo(
    () => txs.filter((t) => isSameMonth(new Date(t.date + 'T00:00'), monthDate)),
    [txs, monthDate]
  )
  const expense = monthTxs.filter((t) => t.type === 'expense')
  const income = monthTxs.filter((t) => t.type === 'income')
  const totalExpense = expense.reduce((a, t) => a + t.amount, 0)
  const totalIncome = income.reduce((a, t) => a + t.amount, 0)

  const byCategory = useMemo(() => {
    const map = {}
    for (const t of expense) map[t.category] = (map[t.category] || 0) + t.amount
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [expense])

  const byPerson = useMemo(
    () =>
      profiles.map((p) => ({
        ...p,
        sum: expense.filter((t) => t.created_by === p.id).reduce((a, t) => a + t.amount, 0),
      })),
    [expense, profiles]
  )

  return (
    <div>
      <div className="stat-cards">
        <div className="stat-card">
          <div className="k">이번 달 지출</div>
          <div className="v num" style={{ color: 'var(--expense)' }}>{won(totalExpense)}원</div>
        </div>
        <div className="stat-card">
          <div className="k">이번 달 수입</div>
          <div className="v num" style={{ color: 'var(--income)' }}>{won(totalIncome)}원</div>
        </div>
      </div>

      <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', margin: '0 4px 8px' }}>누가 썼을까</h4>
      <div className="card" style={{ marginBottom: 14 }}>
        {totalExpense === 0 ? (
          <div className="empty">이번 달 지출이 아직 없어요</div>
        ) : (
          <>
            <div className="split-bar" role="img" aria-label="지출 비율">
              {byPerson.map((p) => (
                <span key={p.id} style={{ width: `${(p.sum / totalExpense) * 100}%`, background: p.color }} />
              ))}
            </div>
            <div className="split-legend">
              {byPerson.map((p) => (
                <span key={p.id}>
                  <span className="legend-dot" style={{ background: p.color }} />
                  {p.display_name} <b className="num">{won(p.sum)}원</b>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', margin: '0 4px 8px' }}>분류별 지출</h4>
      <div className="card">
        {byCategory.length === 0 && <div className="empty">지출을 기록하면 분류별 통계가 보여요</div>}
        {byCategory.map(([cat, sum]) => (
          <div className="bar-row" key={cat}>
            <div className="bar-head">
              <span>{categoryEmoji('expense', cat)} {cat}<span className="pct num">{Math.round((sum / totalExpense) * 100)}%</span></span>
              <span className="num">{won(sum)}원</span>
            </div>
            <div className="bar-track">
              <span className="bar-fill" style={{ width: `${(sum / totalExpense) * 100}%`, background: 'var(--ink)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
