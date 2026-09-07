import { useCallback, useEffect, useMemo, useState } from 'react'
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { supabase } from '../lib/supabase'

// 마지막으로 받아온 달 데이터를 로컬에 남겨, 앱을 열자마자(네트워크·인증 대기 전에) 그린다.
// 키: coupleId + 그리드 시작일. 최근 6개 범위만 보관.
export const DATA_CACHE_KEY = '1+0-data-cache'
const DATA_CACHE_MAX = 6

function readDataCache(key) {
  try {
    const all = JSON.parse(localStorage.getItem(DATA_CACHE_KEY)) || {}
    const hit = all[key]
    return hit && Array.isArray(hit.events) && Array.isArray(hit.txs) ? hit : null
  } catch {
    return null
  }
}

function writeDataCache(key, val) {
  try {
    const all = JSON.parse(localStorage.getItem(DATA_CACHE_KEY)) || {}
    all[key] = { ...val, t: Date.now() }
    const keys = Object.keys(all).sort((a, b) => (all[a].t || 0) - (all[b].t || 0))
    while (keys.length > DATA_CACHE_MAX) delete all[keys.shift()]
    localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(all))
  } catch {
    /* noop */
  }
}

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

  const cacheKey = coupleId ? `${coupleId}:${range.startStr}` : null

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
    if (!ev.error && !tx.error) {
      writeDataCache(`${coupleId}:${range.startStr}`, { events: ev.data || [], txs: tx.data || [] })
    }
    setLoading(false)
  }, [coupleId, range])

  // 범위가 바뀌면: 캐시가 있으면 즉시 그리고, 서버 응답은 뒤에서 덮어쓴다
  useEffect(() => {
    const cached = cacheKey ? readDataCache(cacheKey) : null
    if (cached) {
      setEvents(cached.events)
      setTxs(cached.txs)
      setLoading(false)
    } else {
      setLoading(true)
    }
    reload()
  }, [reload, cacheKey])

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
