// 일정 전날 알림 — '내일(KST)' 시작하는 일정을 찾아 그 커플 멤버 전원에게 푸시
// 매일 1회 cron 으로 호출(아래 _cron.sql 참고). KST 08:00 실행 권장.
// 배포: supabase functions deploy event-reminders --no-verify-jwt
// 시크릿: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// 한계: 반복(가상) 일정은 제외 — 실제 events 행만 대상.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:noreply@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const KST_OFFSET = 9 * 3600 * 1000

Deno.serve(async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  // 'KST 기준 내일' 날짜를 구해 그 하루를 UTC 범위로 환산
  const kstNow = new Date(Date.now() + KST_OFFSET)
  const y = kstNow.getUTCFullYear()
  const m = kstNow.getUTCMonth()
  const d = kstNow.getUTCDate() + 1 // 내일
  const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0) - KST_OFFSET)
  const endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59) - KST_OFFSET)

  const { data: events } = await admin
    .from('events')
    .select('id, title, couple_id, starts_at')
    .gte('starts_at', startUtc.toISOString())
    .lte('starts_at', endUtc.toISOString())

  // 커플별 구독 캐시
  const subsByCouple = new Map<string, { endpoint: string; p256dh: string; auth: string }[]>()
  let sent = 0

  for (const ev of events || []) {
    let subs = subsByCouple.get(ev.couple_id)
    if (!subs) {
      const { data } = await admin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('couple_id', ev.couple_id)
      subs = data || []
      subsByCouple.set(ev.couple_id, subs)
    }
    const payload = JSON.stringify({
      title: '내일 일정이 있어요',
      body: ev.title,
      url: '/',
      tag: `event-${ev.id}`,
    })
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

  return new Response(JSON.stringify({ events: events?.length || 0, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
