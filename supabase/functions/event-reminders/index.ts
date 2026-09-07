// 전날 알림 — '내일(KST)' 기준으로 아래를 찾아 커플 멤버 전원에게 푸시:
//   1) 내일 시작하는 실제 일정(events)
//   2) 내일 도래하는 반복 일정(recurring_events, 매월/매년)
//   3) 내일이 기념일 마일스톤(100일 단위 · n주년)인 커플
// 매일 1회 cron 으로 호출(_cron.sql 참고). KST 09:00 실행 기준.
// 배포: supabase functions deploy event-reminders --no-verify-jwt
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

// 'KST 기준 내일'을 UTC 자정 Date 로 표현 (날짜 계산 전용)
function kstTomorrow() {
  const t = new Date(Date.now() + KST)
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1))
}
const lastDayOf = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate()

Deno.serve(async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  const tomorrow = kstTomorrow()
  const startUtc = new Date(tomorrow.getTime() - KST)
  const endUtc = new Date(startUtc.getTime() + DAY - 1000)
  const ty = tomorrow.getUTCFullYear()
  const tm = tomorrow.getUTCMonth() + 1
  const td = tomorrow.getUTCDate()

  const [eventsQ, recsQ, couplesQ] = await Promise.all([
    admin
      .from('events')
      .select('id, title, couple_id, starts_at')
      .gte('starts_at', startUtc.toISOString())
      .lte('starts_at', endUtc.toISOString()),
    admin
      .from('recurring_events')
      .select('id, title, couple_id, freq, month, day')
      .eq('active', true),
    admin.from('couples').select('id, anniversary').not('anniversary', 'is', null),
  ])

  type Msg = { couple: string; title: string; body: string; tag: string }
  const msgs: Msg[] = []

  // 1) 실제 일정
  for (const ev of eventsQ.data || []) {
    msgs.push({
      couple: ev.couple_id,
      title: '내일 일정이 있어요',
      body: ev.title,
      tag: `event-${ev.id}`,
    })
  }

  // 2) 반복 일정 (일수가 모자라는 달은 말일로)
  for (const r of recsQ.data || []) {
    const due = Math.min(r.day, lastDayOf(ty, tm - 1))
    const hit = r.freq === 'monthly' ? due === td : r.month === tm && due === td
    if (hit) {
      msgs.push({
        couple: r.couple_id,
        title: '내일 일정이 있어요',
        body: `🔁 ${r.title}`,
        tag: `rec-${r.id}`,
      })
    }
  }

  // 3) 기념일 마일스톤 — 사귄 날 = 1일 (앱 계산과 동일)
  for (const c of couplesQ.data || []) {
    const base = new Date(c.anniversary + 'T00:00:00Z')
    let label: string | null = null
    const n = Math.round((tomorrow.getTime() - base.getTime()) / DAY) + 1
    if (n >= 100 && n % 100 === 0) label = `${n}일`
    if (base.getUTCMonth() + 1 === tm && base.getUTCDate() === td && ty > base.getUTCFullYear()) {
      label = `${ty - base.getUTCFullYear()}주년`
    }
    if (label) {
      msgs.push({
        couple: c.id,
        title: '내일은 특별한 날이에요 💞',
        body: `우리 ${label}`,
        tag: `anniv-${c.id}-${label}`,
      })
    }
  }

  // 커플별 구독 캐시 후 발송
  const subsByCouple = new Map<string, { endpoint: string; p256dh: string; auth: string }[]>()
  let sent = 0

  for (const m of msgs) {
    let subs = subsByCouple.get(m.couple)
    if (!subs) {
      const { data } = await admin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('couple_id', m.couple)
      subs = data || []
      subsByCouple.set(m.couple, subs)
    }
    const payload = JSON.stringify({ title: m.title, body: m.body, url: '/', tag: m.tag })
    for (const s of subs) {
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

  return new Response(JSON.stringify({ messages: msgs.length, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
