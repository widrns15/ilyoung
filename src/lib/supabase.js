import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configured = Boolean(url && anon)

// iOS PWA 가 백그라운드에서 얼었다 깨어날 때, 얼어붙은 옛 컨텍스트가 auth Web Lock 을
// 쥔 채 남아 getSession() 이 영원히 대기하는 문제가 있다. 단일 탭 앱이라 잠금이
// 필요 없으므로 no-op lock 으로 대체한다.
const noLock = async (_name, _acquireTimeout, fn) => await fn()

export const supabase = configured
  ? createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true, lock: noLock },
    })
  : null
