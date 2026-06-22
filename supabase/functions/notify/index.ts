// 파트너 활동 알림 — 호출자(actor)의 커플에서 상대방 구독으로 푸시 발송
// 배포: supabase functions deploy notify
// 시크릿: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:noreply@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors })

  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: cors })

  const { title, body, url } = await req.json().catch(() => ({}))
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data: me } = await admin
    .from('profiles')
    .select('couple_id')
    .eq('id', user.id)
    .single()
  if (!me?.couple_id) return new Response(JSON.stringify({ sent: 0 }), { headers: cors })

  // 같은 커플의 상대방(=actor 제외) 구독
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('couple_id', me.couple_id)
    .neq('profile_id', user.id)

  const payload = JSON.stringify({ title: title || '1+0', body: body || '', url: url || '/' })
  let sent = 0
  for (const s of subs || []) {
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
  return new Response(JSON.stringify({ sent }), { headers: cors })
})
