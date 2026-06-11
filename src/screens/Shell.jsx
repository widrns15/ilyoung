import { useMemo, useState } from 'react'
import { addMonths, format, isSameMonth } from 'date-fns'
import { useApp } from '../state/AppContext'
import { useCoupleData } from '../state/useCoupleData'
import CalendarGrid from '../components/CalendarGrid'
import DaySheet from '../components/DaySheet'
import EventModal from '../components/EventModal'
import TxModal from '../components/TxModal'
import StatsView from './StatsView'
import SettingsSheet from './SettingsSheet'
import { won } from '../lib/meta'

const TABS = [
  { id: 'home', label: '홈', icon: '⊞' },
  { id: 'events', label: '일정', icon: '📅' },
  { id: 'money', label: '가계부', icon: '₩' },
  { id: 'stats', label: '통계', icon: '◔' },
]

export default function Shell() {
  const { profile, partner } = useApp()
  const [tab, setTab] = useState('home')
  const [monthDate, setMonthDate] = useState(() => new Date())
  const { events, txs, reload } = useCoupleData(profile.couple_id, monthDate)

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

  const moveMonth = (d) => setMonthDate((m) => addMonths(m, d))
  const goToday = () => setMonthDate(new Date())

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
            <CalendarGrid
              monthDate={monthDate}
              mode={calendarMode}
              events={events}
              txs={txs}
              profiles={profiles}
              onSelectDay={setSelectedDay}
              onSwipe={moveMonth}
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
      {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}
    </div>
  )
}
