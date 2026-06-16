import { useCallback, useEffect, useMemo, useState } from 'react'
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { supabase } from '../lib/supabase'

// 보이는 캘린더 그리드 범위(앞뒤 주 포함)의 일정/거래를 불러오고 실시간 구독
export function useCoupleData(coupleId, monthDate) {
  const [events, setEvents] = useState([])
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)

  const range = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 })
    return { start, end, startStr: format(start, 'yyyy-MM-dd'), endStr: format(end, 'yyyy-MM-dd') }
  }, [monthDate])

  const reload = useCallback(async () => {
    if (!coupleId) return
    const startIso = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate()).toISOString()
    const endIso = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate(), 23, 59, 59).toISOString()
    const [ev, tx] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .eq('couple_id', coupleId)
        .lte('starts_at', endIso)
        .gte('ends_at', startIso)
        .order('starts_at')
        .order('sort_order')
        .order('created_at'),
      supabase
        .from('transactions')
        .select('*')
        .eq('couple_id', coupleId)
        .gte('date', range.startStr)
        .lte('date', range.endStr)
        .order('date'),
    ])
    if (!ev.error) setEvents(ev.data || [])
    if (!tx.error) setTxs(tx.data || [])
    setLoading(false)
  }, [coupleId, range])

  useEffect(() => {
    setLoading(true)
    reload()
  }, [reload])

  useEffect(() => {
    if (!coupleId) return
    const ch = supabase
      .channel(`couple-data-${coupleId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `couple_id=eq.${coupleId}` },
        reload)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `couple_id=eq.${coupleId}` },
        reload)
      .subscribe()
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => { supabase.removeChannel(ch); window.removeEventListener('focus', onFocus) }
  }, [coupleId, reload])

  return { events, txs, loading, reload, range }
}
