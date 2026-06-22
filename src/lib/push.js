import { supabase } from './supabase'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export async function isPushEnabled() {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return Boolean(sub)
}

// 알림 권한 요청 → 구독 → Supabase 저장. 반드시 사용자 제스처(클릭) 안에서 호출.
export async function enablePush(profile) {
  if (!pushSupported()) throw new Error('이 기기는 알림을 지원하지 않아요.')
  if (!VAPID_PUBLIC) throw new Error('알림 키(VAPID)가 설정되지 않았어요.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('알림 권한이 필요해요.')
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
  })
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      profile_id: profile.id,
      couple_id: profile.couple_id,
      endpoint: sub.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

// 파트너에게 활동 알림 — 실패는 조용히 무시(알림 때문에 본 동작이 막히면 안 됨)
export async function notifyPartner({ title, body, url = '/' }) {
  try {
    await supabase.functions.invoke('notify', { body: { title, body, url } })
  } catch {
    /* noop */
  }
}
