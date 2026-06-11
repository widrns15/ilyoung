import { useMemo, useRef } from 'react'
import {
  addDays, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek,
} from 'date-fns'
import { HOLIDAYS_KR } from '../lib/holidays'
import { compactWon } from '../lib/meta'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

// 일정이 해당 날짜에 걸쳐 있는지 (다일 일정 지원)
function eventOnDay(ev, day) {
  const s = new Date(ev.starts_at)
  const e = new Date(ev.ends_at)
  const d0 = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  const d1 = addDays(d0, 1)
  return s < d1 && e >= d0
}

export default function CalendarGrid({ monthDate, mode, events, txs, profiles, onSelectDay, onSwipe }) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [monthDate])

  const colorOf = (id) => profiles.find((p) => p.id === id)?.color || '#9aa1ab'

  const txByDate = useMemo(() => {
    const map = {}
    for (const t of txs) {
      const k = t.date
      if (!map[k]) map[k] = { expense: 0, income: 0 }
      map[k][t.type] += t.amount
    }
    return map
  }, [txs])

  // 좌우 스와이프로 월 이동
  const touch = useRef(null)
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e) => {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.6) onSwipe?.(dx < 0 ? 1 : -1)
  }

  const showEvents = mode !== 'money'
  const showMoney = mode !== 'events'
  const maxChips = mode === 'events' ? 3 : 2

  return (
    <div
      className={`cal ${mode === 'money' ? 'money-mode' : ''}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="cal-week-head" aria-hidden>
        {WEEK.map((w, i) => (
          <span key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</span>
        ))}
      </div>
      <div className="cal-grid" role="grid">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const dow = day.getDay()
          const holiday = HOLIDAYS_KR[key]
          const inMonth = isSameMonth(day, monthDate)
          const dayEvents = showEvents ? events.filter((ev) => eventOnDay(ev, day)) : []
          const sums = txByDate[key]
          return (
            <button
              key={key}
              role="gridcell"
              className={`cal-cell ${inMonth ? '' : 'dim'} ${isToday(day) ? 'today' : ''}`}
              onClick={() => onSelectDay(day)}
              aria-label={format(day, 'M월 d일') + (holiday ? ` ${holiday}` : '')}
            >
              <span className={`d num ${holiday || dow === 0 ? 'sun' : dow === 6 ? 'sat' : ''}`}>
                {day.getDate()}
              </span>
              {holiday && <span className="holi">{holiday}</span>}
              {dayEvents.slice(0, maxChips).map((ev) => (
                <span
                  key={ev.id}
                  className="chip"
                  style={{ '--chip-c': colorOf(ev.created_by) }}
                >
                  {ev.title}
                </span>
              ))}
              {dayEvents.length > maxChips && (
                <span className="chip more">+{dayEvents.length - maxChips}</span>
              )}
              {showMoney && sums && (
                <span className="amts">
                  {sums.expense > 0 && <span className="amt expense num">-{compactWon(sums.expense)}</span>}
                  {sums.income > 0 && <span className="amt income num">+{compactWon(sums.income)}</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
