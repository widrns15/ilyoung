// Scriptable 위젯용 피드 — D-day 와 다가오는 일정(실제 + 반복)을 JSON 으로 제공
// 배포: supabase functions deploy widget-feed --no-verify-jwt
// 시크릿: WIDGET_TOKEN(임의의 긴 문자열), WIDGET_COUPLE_ID(couples.id)
// 호출: GET /widget-feed?token=<WIDGET_TOKEN>
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOKEN = Deno.env.get('WIDGET_TOKEN')!
const COUPLE_ID = Deno.env.get('WIDGET_COUPLE_ID')!

const KST = 9 * 3600 * 1000
const DAY = 86400000
const HORIZON_DAYS = 60
const MAX_EVENTS = 8

// 'KST 오늘 자정'을 UTC 자정 Date 로 표현 (날짜 계산 전용)
function kstToday() {
  const t = new Date(Date.now() + KST)
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()))
}
const dstr = (d: Date) => d.toISOString().slice(0, 10)
// timestamptz → KST 달력 날짜 'yyyy-MM-dd'
const kstDateStr = (iso: string) => new Date(new Date(iso).getTime() + KST).toISOString().slice(0, 10)
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (url.searchParams.get('token') !== TOKEN) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const today = kstToday()
  const horizon = new Date(today.getTime() + HORIZON_DAYS * DAY)

  const [coupleQ, eventsQ, recsQ] = await Promise.all([
    admin.from('couples').select('anniversary').eq('id', COUPLE_ID).single(),
    admin
      .from('events')
      .select('title, starts_at, ends_at')
      .eq('couple_id', COUPLE_ID)
      .gte('ends_at', new Date().toISOString()) // 진행 중 포함
      .order('starts_at')
      .limit(20),
    admin
      .from('recurring_events')
      .select('title, freq, month, day')
      .eq('couple_id', COUPLE_ID)
      .eq('active', true),
  ])

  // 사귄 날 = D+1 (앱의 dday 와 동일)
  const anniv = coupleQ.data?.anniversary
  const dday = anniv
    ? Math.round((today.getTime() - new Date(anniv + 'T00:00:00Z').getTime()) / DAY) + 1
    : null

  type Item = { title: string; date: string; end?: string; recurring?: boolean }
  const items: Item[] = []

  for (const ev of eventsQ.data || []) {
    const date = kstDateStr(ev.starts_at)
    const end = kstDateStr(ev.ends_at)
    items.push({ title: ev.title, date, ...(end !== date ? { end } : {}) })
  }

  // 반복 일정: 오늘 이후 첫 도래일 (일수가 모자라는 달/해는 말일로)
  for (const r of recsQ.data || []) {
    let next: Date | null = null
    if (r.freq === 'monthly') {
      for (let k = 0; k < 3 && !next; k++) {
        const y = today.getUTCFullYear()
        const m = today.getUTCMonth() + k
        const d = new Date(Date.UTC(y, m, Math.min(r.day, lastDayOf(y, m))))
        if (d >= today) next = d
      }
    } else {
      for (let k = 0; k < 2 && !next; k++) {
        const y = today.getUTCFullYear() + k
        const d = new Date(Date.UTC(y, r.month - 1, Math.min(r.day, lastDayOf(y, r.month - 1))))
        if (d >= today) next = d
      }
    }
    if (next && next <= horizon) {
      items.push({ title: r.title, date: dstr(next), recurring: true })
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))

  return new Response(
    JSON.stringify({ today: dstr(today), dday, events: items.slice(0, MAX_EVENTS) }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
