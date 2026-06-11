import React from 'react'
import { createRoot } from 'react-dom/client'
import { configured } from './lib/supabase'
import { AppProvider } from './state/AppContext'
import App from './App'
import './styles.css'

function ConfigMissing() {
  return (
    <div className="auth-wrap">
      <h1>설정이 필요해요</h1>
      <p className="sub">
        프로젝트 루트에 <b>.env</b> 파일을 만들고 Supabase 키를 넣어주세요.
        <br /><br />
        <code style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '10px', display: 'block', fontSize: 12, lineHeight: 1.8 }}>
          VITE_SUPABASE_URL=https://xxxx.supabase.co<br />
          VITE_SUPABASE_ANON_KEY=eyJ...
        </code>
        <br />
        자세한 순서는 README.md를 참고하세요.
      </p>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {configured ? (
      <AppProvider>
        <App />
      </AppProvider>
    ) : (
      <ConfigMissing />
    )}
  </React.StrictMode>
)
