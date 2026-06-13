import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameMonth, isToday, startOfMonth, startOfWeek,
} from 'date-fns'
import { HOLIDAYS_KR } from '../lib/holidays'
import { compactWon } from '../lib/meta'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const LONG_PRESS_MS = 450

// 일정이 해당 날짜에 걸쳐 있는지 (다일 일정 지원)
function eventOnDay(ev, day) {
  const s = new Date(ev.starts_at)
  const e = new Date(ev.ends_at)
  const d0 = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  const d1 = addDays(d0, 1)
  return s < d1 && e >= d0
}

// 한 주(7칸) 안에서 일정을 lane(가로 줄)에 배치 — 다일 일정이 같은 lane을 차지해
// 칸마다 같은 세로 위치에 놓이도록 한다. 겹치지 않으면 같은 lane을 재사용.
function buildWeekLayout(week, events) {
  const segs = []
  for (const ev of events) {
    let start = -1
    let end = -1
    for (let i = 0; i < 7; i++) {
      if (eventOnDay(ev, week[i])) {
        if (start < 0) start = i
        end = i
      }
    }
    if (start < 0) continue
    segs.push({ ev, start, end, lane: 0 })
  }
  segs.sort((a, b) =>
    a.start - b.start ||
    (b.end - b.start) - (a.end - a.start) ||
    String(a.ev.starts_at).localeCompare(String(b.ev.starts_at))
  )
  const laneEnd = []
  for (const seg of segs) {
    let lane = 0
    while (lane < laneEnd.length && laneEnd[lane] >= seg.start) lane++
    laneEnd[lane] = seg.end
    seg.lane = lane
  }
  return segs
}

export default function CalendarGrid({
  monthDate, mode, events, txs, anniv = {}, previews = {}, profiles,
  onSelectDay, onSwipe, onMoveEvent, onDeleteEvent,
}) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [monthDate])

  const weeks = useMemo(() => {
    const out = []
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7))
    return out
  }, [days])

  const showEvents = mode !== 'money'
  const layouts = useMemo(
    () => (showEvents ? weeks.map((w) => buildWeekLayout(w, events)) : weeks.map(() => [])),
    [weeks, events, showEvents]
  )

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

  // ----- 일정 칩 꾹 눌러서 드래그 이동 / 삭제 -----
  const [dragEv, setDragEv] = useState(null)
  const [overKey, setOverKey] = useState(null) // 'yyyy-MM-dd' | 'trash' | null
  const ghostRef = useRef(null)
  const press = useRef(null) // { ev, x, y, id, el, timer, dragging }
  const recentDrag = useRef(false)

  // 칩을 직접 누르면 그 일정, 일정이 하나뿐인 날은 셀 아무 곳이나 눌러도 그 일정
  const cellDown = (e, dayEvents) => {
    if (e.button || !dayEvents.length) return
    const chipEl = e.target.closest('.chip[data-ev]')
    const ev = chipEl
      ? dayEvents.find((x) => x.id === chipEl.dataset.ev)
      : dayEvents.length === 1 ? dayEvents[0] : null
    // 가상(반복) 일정은 개별 이동/삭제 불가 — 규칙에서만 수정
    if (!ev || ev.virtual) return
    const el = e.currentTarget
    const p = { ev, x: e.clientX, y: e.clientY, id: e.pointerId, el, dragging: false }
    p.timer = setTimeout(() => {
      try { el.setPointerCapture(p.id) } catch { /* noop */ }
      p.dragging = true
      navigator.vibrate?.(10)
      setDragEv(ev)
      setOverKey(null)
      if (ghostRef.current) positionGhost(p.x, p.y)
    }, LONG_PRESS_MS)
    press.current = p
  }

  const positionGhost = (x, y) => {
    const g = ghostRef.current
    if (!g) return
    g.style.left = `${x}px`
    g.style.top = `${y}px`
  }

  const chipMove = (e) => {
    const p = press.current
    if (!p) return
    if (!p.dragging) {
      // 누른 채 움직이면 스크롤 의도로 보고 길게 누르기 취소
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
        clearTimeout(p.timer)
        press.current = null
      }
      return
    }
    positionGhost(e.clientX, e.clientY)
    const hit = document.elementFromPoint(e.clientX, e.clientY)
    if (hit?.closest('.drag-trash')) setOverKey('trash')
    else setOverKey(hit?.closest('[data-day]')?.dataset.day || null)
  }

  const chipUp = () => {
    const p = press.current
    press.current = null
    if (!p) return
    clearTimeout(p.timer)
    if (!p.dragging) return
    recentDrag.current = true
    setTimeout(() => { recentDrag.current = false }, 350)
    const target = overKey
    setDragEv(null)
    setOverKey(null)
    if (target === 'trash') onDeleteEvent?.(p.ev)
    else if (target && target !== format(new Date(p.ev.starts_at), 'yyyy-MM-dd')) onMoveEvent?.(p.ev, target)
  }

  // 드래그 중 브라우저 스크롤 차단 (길게 누르는 동안은 정지 상태라 안전하게 가로챌 수 있음)
  useEffect(() => {
    if (!dragEv) return
    const prevent = (e) => e.preventDefault()
    document.addEventListener('touchmove', prevent, { passive: false })
    return () => document.removeEventListener('touchmove', prevent)
  }, [dragEv])

  // 드래그 직후 셀 클릭(DaySheet 열림) 무시
  const onClickCapture = (e) => {
    if (recentDrag.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  // 좌우 스와이프로 월 이동
  const touch = useRef(null)
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e) => {
    if (!touch.current) return
    if (dragEv || recentDrag.current) { touch.current = null; return }
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.6) onSwipe?.(dx < 0 ? 1 : -1)
  }

  const showMoney = mode !== 'events'
  const maxLanes = mode === 'events' ? 3 : 2

  return (
    <div
      className={`cal ${mode === 'money' ? 'money-mode' : ''}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClickCapture={onClickCapture}
    >
      <div className="cal-week-head" aria-hidden>
        {WEEK.map((w, i) => (
          <span key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</span>
        ))}
      </div>
      <div className="cal-grid" role="grid">
        {weeks.map((week, wi) =>
          week.map((day, c) => {
            const key = format(day, 'yyyy-MM-dd')
            const dow = day.getDay()
            const holiday = HOLIDAYS_KR[key]
            const annivLabel = anniv[key]
            const inMonth = isSameMonth(day, monthDate)
            const daySegs = layouts[wi].filter((s) => s.start <= c && c <= s.end)
            const visible = daySegs.filter((s) => s.lane < maxLanes)
            const hidden = daySegs.length - visible.length
            const maxLane = visible.reduce((m, s) => Math.max(m, s.lane), -1)
            const dayEvents = daySegs.map((s) => s.ev)
            const sums = txByDate[key]
            const plan = previews[key]
            return (
              <button
                key={key}
                role="gridcell"
                data-day={key}
                className={`cal-cell ${inMonth ? '' : 'dim'} ${isToday(day) ? 'today' : ''} ${dragEv && overKey === key ? 'drop' : ''}`}
                onClick={() => onSelectDay(day)}
                onPointerDown={(e) => cellDown(e, dayEvents)}
                onPointerMove={chipMove}
                onPointerUp={chipUp}
                onPointerCancel={chipUp}
                onContextMenu={(e) => e.preventDefault()}
                aria-label={format(day, 'M월 d일') + (holiday ? ` ${holiday}` : '') + (annivLabel ? ` ${annivLabel}` : '')}
              >
                <span className="cell-head">
                  <span className={`d num ${holiday || dow === 0 ? 'sun' : dow === 6 ? 'sat' : ''}`}>
                    {day.getDate()}
                  </span>
                  {holiday && <span className="holi">{holiday}</span>}
                  {annivLabel && <span className="holi anniv">♥ {annivLabel}</span>}
                </span>
                {showEvents && maxLane >= 0 && (
                  <span className="cell-lanes">
                    {Array.from({ length: maxLane + 1 }).map((_, lane) => {
                      const seg = visible.find((s) => s.lane === lane)
                      if (!seg) return <span key={lane} className="chip-slot" aria-hidden />
                      const ev = seg.ev
                      const prev = eventOnDay(ev, addDays(day, -1))
                      const next = eventOnDay(ev, addDays(day, 1))
                      const cls = [
                        'chip',
                        dragEv?.id === ev.id ? 'lifting' : '',
                        prev ? '' : 'rl',
                        next ? '' : 'rr',
                        prev && c !== 0 ? 'bl' : '',
                        next && c !== 6 ? 'br' : '',
                      ].filter(Boolean).join(' ')
                      return (
                        <span
                          key={lane}
                          data-ev={ev.id}
                          className={cls}
                          style={{ '--chip-c': colorOf(ev.created_by) }}
                        >
                          {!prev || c === 0 ? ev.title : ' '}
                        </span>
                      )
                    })}
                    {hidden > 0 && <span className="chip more">+{hidden}</span>}
                  </span>
                )}
                {showMoney && (sums || plan) && (
                  <span className="amts">
                    {sums?.expense > 0 && <span className="amt expense num">-{compactWon(sums.expense)}</span>}
                    {sums?.income > 0 && <span className="amt income num">+{compactWon(sums.income)}</span>}
                    {plan?.expense > 0 && <span className="amt expense plan num">🔁-{compactWon(plan.expense)}</span>}
                    {plan?.income > 0 && <span className="amt income plan num">🔁+{compactWon(plan.income)}</span>}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>

      {dragEv && (
        <>
          <div
            ref={ghostRef}
            className="drag-ghost chip"
            style={{ '--chip-c': colorOf(dragEv.created_by) }}
            aria-hidden
          >
            {dragEv.title}
          </div>
          <div className={`drag-trash ${overKey === 'trash' ? 'on' : ''}`} aria-hidden>
            🗑 여기에 놓으면 삭제
          </div>
        </>
      )}
    </div>
  )
}
