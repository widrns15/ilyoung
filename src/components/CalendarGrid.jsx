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

// 한 주(7칸) 안에서 일정을 lane(가로 줄)에 배치. 다일 일정은 컬럼을 span 하는 하나의 막대가 된다.
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

// 주별 렌더 메타: 보이는 lane 수, 칸별 초과 개수
function weekMeta(layout, maxLanes) {
  let maxLane = -1
  for (const s of layout) if (s.lane < maxLanes) maxLane = Math.max(maxLane, s.lane)
  const usedLanes = maxLane + 1
  const overflow = {}
  for (const s of layout) {
    if (s.lane < maxLanes) continue
    for (let c = s.start; c <= s.end; c++) overflow[c] = (overflow[c] || 0) + 1
  }
  const hasOverflow = Object.keys(overflow).length > 0
  return { usedLanes, overflow, hasOverflow, rows: usedLanes + (hasOverflow ? 1 : 0) }
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
  const showMoney = mode !== 'events'
  const maxLanes = mode === 'events' ? 4 : 2

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

  // ----- 일정 막대 꾹 눌러서 드래그 이동 / 삭제 -----
  const [dragEv, setDragEv] = useState(null)
  const [overKey, setOverKey] = useState(null) // 'yyyy-MM-dd' | 'trash' | null
  const ghostRef = useRef(null)
  const press = useRef(null)
  const recentDrag = useRef(false)

  const positionGhost = (x, y) => {
    const g = ghostRef.current
    if (!g) return
    g.style.left = `${x}px`
    g.style.top = `${y}px`
  }

  // 오버레이 위 가로 위치로 그 주의 날짜 칸을 역산
  const dayFromOverlay = (overlayEl, wi, x) => {
    const r = overlayEl.getBoundingClientRect()
    let col = Math.floor((x - r.left) / (r.width / 7))
    col = Math.max(0, Math.min(6, col))
    return weeks[wi][col]
  }

  const barDown = (e, ev, wi) => {
    if (e.button || ev.virtual) return // 가상(반복) 일정은 이동/삭제 불가
    const el = e.currentTarget
    const overlayEl = el.parentElement
    const p = { ev, wi, x0: e.clientX, y0: e.clientY, lastX: e.clientX, lastY: e.clientY, id: e.pointerId, el, overlayEl, dragging: false }
    p.timer = setTimeout(() => {
      try { el.setPointerCapture(p.id) } catch { /* noop */ }
      p.dragging = true
      navigator.vibrate?.(10)
      setDragEv(ev)
      setOverKey(null)
      positionGhost(p.lastX, p.lastY)
    }, LONG_PRESS_MS)
    press.current = p
  }

  const barMove = (e) => {
    const p = press.current
    if (!p) return
    p.lastX = e.clientX
    p.lastY = e.clientY
    if (!p.dragging) {
      if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 8) {
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

  const barUp = () => {
    const p = press.current
    press.current = null
    if (!p) return
    clearTimeout(p.timer)
    if (!p.dragging) {
      onSelectDay(dayFromOverlay(p.overlayEl, p.wi, p.lastX))
      return
    }
    recentDrag.current = true
    setTimeout(() => { recentDrag.current = false }, 350)
    const target = overKey
    setDragEv(null)
    setOverKey(null)
    if (target === 'trash') onDeleteEvent?.(p.ev)
    else if (target && target !== format(new Date(p.ev.starts_at), 'yyyy-MM-dd')) onMoveEvent?.(p.ev, target)
  }

  // 드래그 중 스크롤 차단
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

  return (
    <div
      className={`cal ${mode === 'money' ? 'money-mode' : ''} ${mode === 'events' ? 'events-mode' : ''} ${dragEv ? 'dragging' : ''}`}
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
        {weeks.map((week, wi) => {
          const layout = layouts[wi]
          const meta = weekMeta(layout, maxLanes)
          const visible = layout.filter((s) => s.lane < maxLanes)
          // 공휴일/기념일이 있는 주만 헤더를 높여 텍스트 자리를 확보, 없으면 낮춰 막대를 위로 붙인다
          const hasSpecial = week.some((day) => {
            const k = format(day, 'yyyy-MM-dd')
            return HOLIDAYS_KR[k] || anniv[k]
          })
          return (
            <div className="cal-week" key={wi} style={{ '--rows': meta.rows, '--head-h': hasSpecial ? '32px' : '23px' }}>
              <div className="cal-week-cells">
                {week.map((day) => {
                  const key = format(day, 'yyyy-MM-dd')
                  const dow = day.getDay()
                  const holiday = HOLIDAYS_KR[key]
                  const annivLabel = anniv[key]
                  const inMonth = isSameMonth(day, monthDate)
                  const sums = txByDate[key]
                  const plan = previews[key]
                  return (
                    <button
                      key={key}
                      role="gridcell"
                      data-day={key}
                      className={`cal-cell ${inMonth ? '' : 'dim'} ${isToday(day) ? 'today' : ''} ${dragEv && overKey === key ? 'drop' : ''}`}
                      onClick={() => onSelectDay(day)}
                      aria-label={format(day, 'M월 d일') + (holiday ? ` ${holiday}` : '') + (annivLabel ? ` ${annivLabel}` : '')}
                    >
                      <span className="cell-head">
                        <span className={`d num ${holiday || dow === 0 ? 'sun' : dow === 6 ? 'sat' : ''}`}>
                          {day.getDate()}
                        </span>
                        {holiday && <span className="holi">{holiday}</span>}
                        {annivLabel && <span className="holi anniv">♥ {annivLabel}</span>}
                      </span>
                      {showEvents && <span className="cal-bar-spacer" aria-hidden />}
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
                })}
              </div>

              {showEvents && meta.rows > 0 && (
                <div className="cal-week-bars">
                  {visible.map((s) => {
                    const inMonth = isSameMonth(week[s.start], monthDate)
                    return (
                      <button
                        key={s.ev.id}
                        data-ev={s.ev.id}
                        className={`cal-bar ${s.end > s.start ? 'span' : ''} ${dragEv?.id === s.ev.id ? 'lifting' : ''} ${inMonth ? '' : 'dim'} ${s.ev.virtual ? 'virtual' : ''}`}
                        style={{
                          gridColumn: `${s.start + 1} / ${s.end + 2}`,
                          gridRow: s.lane + 1,
                          '--chip-c': colorOf(s.ev.created_by),
                        }}
                        onPointerDown={(e) => barDown(e, s.ev, wi)}
                        onPointerMove={barMove}
                        onPointerUp={barUp}
                        onPointerCancel={barUp}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {s.ev.title}
                      </button>
                    )
                  })}
                  {Object.entries(meta.overflow).map(([c, n]) => (
                    <span
                      key={`more-${c}`}
                      className="cal-more"
                      style={{ gridColumn: `${Number(c) + 1}`, gridRow: meta.usedLanes + 1 }}
                    >
                      +{n}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {dragEv && (
        <>
          <div
            ref={ghostRef}
            className="drag-ghost cal-bar"
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
