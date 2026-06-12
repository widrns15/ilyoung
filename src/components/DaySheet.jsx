import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { categoryEmoji, won } from '../lib/meta'
import Sheet from './Sheet'

export default function DaySheet({ day, events, txs, profiles, onClose, onAddEvent, onAddTx, onEditEvent, onEditTx }) {
  const key = format(day, 'yyyy-MM-dd')
  const dayEvents = events.filter((ev) => {
    const s = new Date(ev.starts_at); const e = new Date(ev.ends_at)
    const d0 = new Date(day.getFullYear(), day.getMonth(), day.getDate())
    const d1 = new Date(d0); d1.setDate(d1.getDate() + 1)
    return s < d1 && e >= d0
  })
  const dayTxs = txs.filter((t) => t.date === key)
  const expense = dayTxs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
  const income = dayTxs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0)
  const nameOf = (id) => profiles.find((p) => p.id === id)?.display_name || ''
  const colorOf = (id) => profiles.find((p) => p.id === id)?.color || '#9aa1ab'

  return (
    <Sheet onClose={onClose} label={format(day, 'M월 d일')}>
        <div className="sheet-head">
          <span className="sheet-title">{format(day, 'M월 d일 EEEE', { locale: ko })}</span>
          <span className="month-summary" style={{ padding: 0 }}>
            {expense > 0 && <span className="val expense num">-{won(expense)}</span>}
            {income > 0 && <span className="val income num">+{won(income)}</span>}
          </span>
        </div>

        <h4>일정 {dayEvents.length > 0 && `${dayEvents.length}`}</h4>
        <div className="card">
          {dayEvents.length === 0 && <div className="empty">이 날의 일정이 없어요</div>}
          {dayEvents.map((ev) => (
            <button key={ev.id} className="row" onClick={() => onEditEvent(ev)}>
              <span className="who" style={{ background: colorOf(ev.created_by) }} />
              <span className="grow">
                <span className="t1">{ev.title}</span>
                <span className="t2">
                  {ev.virtual && '🔁 '}
                  {ev.all_day ? '하루 종일' : `${format(new Date(ev.starts_at), 'HH:mm')} – ${format(new Date(ev.ends_at), 'HH:mm')}`}
                  {' · '}{nameOf(ev.created_by)}
                </span>
              </span>
              <span className="t2">›</span>
            </button>
          ))}
        </div>

        <h4>가계부 {dayTxs.length > 0 && `${dayTxs.length}`}</h4>
        <div className="card">
          {dayTxs.length === 0 && <div className="empty">이 날의 내역이 없어요</div>}
          {dayTxs.map((t) => (
            <button key={t.id} className="row" onClick={() => onEditTx(t)}>
              <span className="emoji">{categoryEmoji(t.type, t.category)}</span>
              <span className="grow">
                <span className="t1">{t.memo || t.category}</span>
                <span className="t2">
                  {t.recurring_rule_id && '🔁 '}{t.category} · {nameOf(t.created_by)}
                  <span className="who" style={{ background: colorOf(t.created_by), display: 'inline-block', marginLeft: 6, verticalAlign: 'middle' }} />
                </span>
              </span>
              <span className={`money num ${t.type}`}>
                {t.type === 'expense' ? '-' : '+'}{won(t.amount)}
              </span>
            </button>
          ))}
        </div>

        <div className="form-row" style={{ marginTop: 16 }}>
          <button className="btn ghost" onClick={() => onAddEvent(day)}>+ 일정</button>
          <button className="btn" onClick={() => onAddTx(day)}>+ 지출·수입</button>
        </div>
    </Sheet>
  )
}
