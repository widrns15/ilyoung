// 가계부 리마인드 — cron 이 body.job 으로 어떤 알림을 보낼지 지정한다(_cron.sql 참고).
//   job=weekly : 주말 결산. 일요일 저녁(KST 20:00) 이번 주(월~일) 지출 합계·지난주 대비·최다 분류.
//                이번 주 지출 기록이 없는 커플은 건너뛴다(미기록 리마인드가 담당).
//   job=idle   : 미기록 리마인드. 매일 저녁(KST 19:00) 마지막 가계부 기록(created_at, KST 날짜)이
//                5일 전이면 발송, 이후 5일마다(10·15·…) 반복, 30일이 지나면 그만둔다.
// 사람별 설정(profiles.remind_recap / remind_idle)이 꺼져 있으면 그 사람 구독엔 보내지 않는다.
// 배포: supabase functions deploy ledger-reminders --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:noreply@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const KST = 9 * 3600 * 1000
const DAY = 86400000
const IDLE_EVERY_DAYS = 5
const IDLE_MAX_DAYS = 30

// 'KST 오늘 자정'을 UTC 자정 Date 로 표현 (날짜 계산 전용)
function kstToday() {
  const t = new Date(Date.now() + KST)
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()))
}
const dstr = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)
// timestamptz → KST 달력 날짜(UTC 자정 Date)
const kstDateOf = (iso: string) => {
  const t = new Date(new Date(iso).getTime() + KST)
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()))
}
const won = (n: number) => n.toLocaleString('ko-KR')

type Msg = { couple: string; title: string; body: string; tag: string; pref: 'remind_recap' | 'remind_idle' }
type Tx = { couple_id: string; date: string; amount: number; type: string; category: string }

// ---------- 주말 결산 ----------
async function weeklyRecap(admin: ReturnType<typeof createClient>, today: Date): Promise<Msg[]> {
  // 일요일 실행 기준: 이번 주 = 6일 전(월) ~ 오늘(일), 지난주 = 그 앞 7일
  const thisStart = addDays(today, -6)
  const lastStart = addDays(thisStart, -7)
  const { data } = await admin
    .from('transactions')
    .select('couple_id, date, amount, type, category')
    .eq('type', 'expense')
    .gte('date', dstr(lastStart))
    .lte('date', dstr(today))

  type Agg = { thisTotal: number; lastTotal: number; byCat: Record<string, number> }
  const byCouple = new Map<string, Agg>()
  for (const t of (data || []) as Tx[]) {
    const a = byCouple.get(t.couple_id) || { thisTotal: 0, lastTotal: 0, byCat: {} }
    if (t.date >= dstr(thisStart)) {
      a.thisTotal += t.amount
      a.byCat[t.category] = (a.byCat[t.category] || 0) + t.amount
    } else {
      a.lastTotal += t.amount
    }
    byCouple.set(t.couple_id, a)
  }

  const msgs: Msg[] = []
  for (const [couple, a] of byCouple) {
    if (a.thisTotal <= 0) continue
    const parts = [`이번 주 둘이 ${won(a.thisTotal)}원 썼어요.`]
    if (a.lastTotal > 0) {
      const diff = a.thisTotal - a.lastTotal
      if (diff === 0) parts.push('지난주와 똑같아요.')
      else parts.push(`지난주보다 ${won(Math.abs(diff))}원 ${diff > 0 ? '더' : '덜'} 썼어요.`)
    }
    const top = Object.entries(a.byCat).sort((x, y) => y[1] - x[1])[0]
    if (top) parts.push(`가장 많이 쓴 건 ${top[0]}.`)
    msgs.push({
      couple,
      title: '이번 주 결산 📒',
      body: parts.join(' '),
      tag: `recap-${couple}-${dstr(thisStart)}`,
      pref: 'remind_recap',
    })
  }
  return msgs
}

// ---------- 미기록 리마인드 ----------
async function idleReminder(admin: ReturnType<typeof createClient>, today: Date): Promise<Msg[]> {
  // 최근 IDLE_EVERY_DAYS 일 안에 기록한 커플은 활성 → 제외
  const cutoff = new Date(addDays(today, -(IDLE_EVERY_DAYS - 1)).getTime() - KST) // KST (오늘-4) 00:00
  const [couplesQ, activeQ] = await Promise.all([
    admin.from('couples').select('id'),
    admin.from('transactions').select('couple_id').gte('created_at', cutoff.toISOString()),
  ])
  const active = new Set((activeQ.data || []).map((r: { couple_id: string }) => r.couple_id))

  const msgs: Msg[] = []
  for (const c of (couplesQ.data || []) as { id: string }[]) {
    if (active.has(c.id)) continue
    // 커플의 마지막 기록. 기록이 아예 없는 새 커플은 재촉하지 않는다.
    const { data: last } = await admin
      .from('transactions')
      .select('created_at')
      .eq('couple_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!last) continue
    const idleDays = Math.round((today.getTime() - kstDateOf(last.created_at).getTime()) / DAY)
    if (idleDays < IDLE_EVERY_DAYS || idleDays > IDLE_MAX_DAYS) continue
    if (idleDays % IDLE_EVERY_DAYS !== 0) continue
    msgs.push({
      couple: c.id,
      title: '가계부가 조용해요 🍃',
      body: `${idleDays}일째 기록이 없어요. 최근 쓴 것만 30초 정리해볼까요?`,
      tag: `idle-${c.id}-${dstr(today)}`,
      pref: 'remind_idle',
    })
  }
  return msgs
}

Deno.serve(async (req) => {
  const { job } = await req.json().catch(() => ({}))
  if (job !== 'weekly' && job !== 'idle') {
    return new Response(JSON.stringify({ error: "body.job must be 'weekly' or 'idle'" }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const today = kstToday()
  const msgs = job === 'weekly' ? await weeklyRecap(admin, today) : await idleReminder(admin, today)

  // 커플별 구독(+사람별 설정) 캐시 후 발송
  type Sub = { endpoint: string; p256dh: string; auth: string; profile: { remind_recap: boolean; remind_idle: boolean } | null }
  const subsByCouple = new Map<string, Sub[]>()
  let sent = 0

  for (const m of msgs) {
    let subs = subsByCouple.get(m.couple)
    if (!subs) {
      const { data } = await admin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth, profile:profiles(remind_recap, remind_idle)')
        .eq('couple_id', m.couple)
      subs = (data || []) as unknown as Sub[]
      subsByCouple.set(m.couple, subs)
    }
    const payload = JSON.stringify({ title: m.title, body: m.body, url: '/', tag: m.tag })
    for (const s of subs) {
      if (s.profile && s.profile[m.pref] === false) continue
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        }
      }
    }
  }

  return new Response(JSON.stringify({ job, messages: msgs.length, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
