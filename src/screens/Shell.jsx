import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, addMonths, differenceInCalendarDays, format, isSameMonth } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useApp } from '../state/AppContext'
import { useCoupleData } from '../state/useCoupleData'
import CalendarGrid from '../components/CalendarGrid'
import DaySheet from '../components/DaySheet'
import EventModal from '../components/EventModal'
import TxModal from '../components/TxModal'
import StatsView from './StatsView'
import SettingsSheet from './SettingsSheet'
import { won } from '../lib/meta'
import { runRecurringRules, upcomingPreviews } from '../lib/recurrence'
import { anniversaryMarks, dday } from '../lib/anniversary'

const TABS = [
  { id: 'home', label: '홈', icon: '⊞' },
  { id: 'events', label: '일정', icon: '📅' },
  { id: 'money', label: '가계부', icon: '₩' },
  { id: 'stats', label: '통계', icon: '◔' },
]

export default function Shell() {
  const { profile, partner, couple, guard, toast } = useApp()
  const [tab, setTab] = useState('home')
  const [monthDate, setMonthDate] = useState(() => new Date())
  const { events, txs, reload, range } = useCoupleData(profile.couple_id, monthDate)

  // 앱이 열릴 때 도래한 반복 거래를 생성 (중복은 DB unique 인덱스가 차단)
  useEffect(() => {
    runRecurringRules(profile.couple_id).then((n) => { if (n) reload() })
  }, [profile.couple_id]) // eslint-disable-line

  // 활성 반복 규칙: 미래 도래일을 캘린더에 예정으로 미리 보여주기 위해
  const [rules, setRules] = useState([])
  const fetchRules = useCallback(async () => {
    const { data } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('couple_id', profile.couple_id)
      .eq('active', true)
    setRules(data || [])
  }, [profile.couple_id])
  useEffect(() => {
    fetchRules()
    window.addEventListener('focus', fetchRules)
    return () => window.removeEventListener('focus', fetchRules)
  }, [fetchRules])

  const [selectedDay, setSelectedDay] = useState(null)
  const [eventModal, setEventModal] = useState(null) // { initial?, day }
  const [txModal, setTxModal] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  const profiles = useMemo(() => [profile, partner].filter(Boolean), [profile, partner])

  const monthTxs = useMemo(
    () => txs.filter((t) => isSameMonth(new Date(t.date + 'T00:00'), monthDate)),
    [txs, monthDate]
  )
  const monthExpense = monthTxs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
  const monthIncome = monthTxs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0)

  const budget = couple?.monthly_budget || 0
  const overBudget = budget > 0 && monthExpense > budget

  const annivMarks = useMemo(
    () => (couple?.anniversary ? anniversaryMarks(couple.anniversary, range.start, range.end) : {}),
    [couple?.anniversary, range]
  )

  const previewMap = useMemo(
    () => upcomingPreviews(rules, range.start, range.end),
    [rules, range]
  )

  const moveMonth = (d) => setMonthDate((m) => addMonths(m, d))
  const goToday = () => setMonthDate(new Date())

  // 일정 칩 드래그 드롭: 시작·종료를 같은 간격으로 이동 (시각은 유지)
  const moveEvent = async (ev, dayKey) => {
    const start = new Date(ev.starts_at)
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const delta = differenceInCalendarDays(new Date(dayKey + 'T00:00'), startDay)
    if (!delta) return
    const { ok } = await guard(async () => {
      const { error } = await supabase.from('events').update({
        starts_at: addDays(start, delta).toISOString(),
        ends_at: addDays(new Date(ev.ends_at), delta).toISOString(),
      }).eq('id', ev.id)
      if (error) throw error
    })
    if (ok) {
      toast(`'${ev.title}'을(를) ${format(new Date(dayKey + 'T00:00'), 'M월 d일')}로 옮겼어요.`)
      reload()
    }
  }

  const deleteEvent = async (ev) => {
    if (!confirm(`'${ev.title}' 일정을 삭제할까요? 연결된 가계부 내역은 남아요.`)) return
    const { ok } = await guard(async () => {
      const { error } = await supabase.from('events').delete().eq('id', ev.id)
      if (error) throw error
    })
    if (ok) { toast('일정을 삭제했어요.'); reload() }
  }

  // 일정 탭에서 + 누르면 일정, 그 외엔 가계부 입력이 기본
  const onFab = () => {
    const day = new Date()
    if (tab === 'events') setEventModal({ day })
    else setTxModal({ day })
  }

  const calendarMode = tab === 'events' ? 'events' : tab === 'money' ? 'money' : 'all'

  return (
    <div className="app">
      <header className="app-header">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => moveMonth(-1)} aria-label="이전 달">‹</button>
          <span className="month-title num">
            {format(monthDate, 'M월')}
            <small>{format(monthDate, 'yyyy')}</small>
          </span>
          <button className="icon-btn" onClick={() => moveMonth(1)} aria-label="다음 달">›</button>
        </div>
        {!isSameMonth(monthDate, new Date()) && (
          <button className="today-btn" onClick={goToday}>오늘</button>
        )}
        {couple?.anniversary && (
          <span className="dday num" title={`${couple.anniversary}부터`}>D+{dday(couple.anniversary)}</span>
        )}
        <button
          className="icon-btn" onClick={() => setShowSettings(true)} aria-label="설정"
          style={{ width: 'auto', padding: '0 2px' }}
        >
          <span className="pair-dots">
            {profiles.map((p) => (
              <span key={p.id} className="dot" style={{ background: p.color }} title={p.display_name} />
            ))}
          </span>
        </button>
      </header>

      <main className="view">
        {tab !== 'stats' && (
          <>
            {tab !== 'events' && (
              <div className="month-summary num" aria-live="polite">
                <span><span className="lbl">지출</span><span className="val expense">{won(monthExpense)}원</span></span>
                <span><span className="lbl">수입</span><span className="val income">{won(monthIncome)}원</span></span>
              </div>
            )}
            {tab !== 'events' && budget > 0 && (
              <div className="budget">
                <div className="budget-head">
                  <span>이번 달 예산 <b className="num">{won(budget)}원</b></span>
                  <span className={overBudget ? 'over' : ''}>
                    {overBudget
                      ? <><b className="num">{won(monthExpense - budget)}원</b> 초과</>
                      : <><b className="num">{won(budget - monthExpense)}원</b> 남음</>}
                  </span>
                </div>
                <div className="budget-track" role="progressbar" aria-valuenow={Math.min(100, Math.round((monthExpense / budget) * 100))} aria-valuemin={0} aria-valuemax={100}>
                  <span
                    className={`budget-fill ${overBudget ? 'over' : ''}`}
                    style={{ width: `${Math.min(100, (monthExpense / budget) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            <CalendarGrid
              monthDate={monthDate}
              mode={calendarMode}
              events={events}
              txs={txs}
              anniv={annivMarks}
              previews={previewMap}
              profiles={profiles}
              onSelectDay={setSelectedDay}
              onSwipe={moveMonth}
              onMoveEvent={moveEvent}
              onDeleteEvent={deleteEvent}
            />
          </>
        )}
        {tab === 'stats' && <StatsView monthDate={monthDate} txs={txs} profiles={profiles} />}
      </main>

      {tab !== 'stats' && (
        <button className="fab" onClick={onFab} aria-label="추가">+</button>
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="ti" aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {selectedDay && !eventModal && !txModal && (
        <DaySheet
          day={selectedDay}
          events={events}
          txs={txs}
          profiles={profiles}
          onClose={() => setSelectedDay(null)}
          onAddEvent={(day) => setEventModal({ day })}
          onAddTx={(day) => setTxModal({ day })}
          onEditEvent={(ev) => setEventModal({ initial: ev, day: selectedDay })}
          onEditTx={(t) => setTxModal({ initial: t, day: selectedDay })}
        />
      )}
      {eventModal && (
        <EventModal
          initial={eventModal.initial}
          defaultDay={eventModal.day}
          txs={txs}
          onClose={() => setEventModal(null)}
          onSaved={reload}
        />
      )}
      {txModal && (
        <TxModal
          initial={txModal.initial}
          defaultDay={txModal.day}
          events={events}
          onClose={() => setTxModal(null)}
          onSaved={reload}
        />
      )}
      {showSettings && (
        <SettingsSheet onClose={() => { setShowSettings(false); fetchRules() }} />
      )}
    </div>
  )
}
