import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../state/AppContext';

export default function AuthScreen() {
  const { guard, toast } = useApp();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    if (mode === 'signup') {
      const { ok, data } = await guard(async () => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() || email.split('@')[0] },
          },
        });
        if (error) throw error;
        return data;
      });
      if (ok && data?.user && !data.session) {
        toast('확인 메일을 보냈어요. 메일함을 확인해주세요.');
      }
    } else {
      await guard(async () => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw new Error('이메일 또는 비밀번호가 맞지 않아요.');
      });
    }
    setBusy(false);
  };

  return (
    <div className="auth-wrap">
      <div className="logo-mark" aria-hidden>
        <span style={{ background: '#F2685C' }} />
        <span style={{ background: '#4D7CFE' }} />
      </div>
      <h1>1+0</h1>
      <p className="sub">
        일정과 가계부를 둘이 함께, 하나의 캘린더에서.
        <br />
        {mode === 'login'
          ? '다시 만나서 반가워요.'
          : '계정을 만들고 상대방과 연결해보세요.'}
      </p>
      <form className="form" onSubmit={submit}>
        {mode === 'signup' && (
          <input
            placeholder="이름 (상대방에게 보여요)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
          />
        )}
        <input
          type="email"
          required
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="비밀번호 (6자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
        <button className="btn" disabled={busy}>
          {mode === 'login' ? '로그인' : '가입하기'}
        </button>
      </form>
      <button
        className="auth-switch"
        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
      >
        {mode === 'login' ? (
          <>
            처음이신가요? <b>가입하기</b>
          </>
        ) : (
          <>
            이미 계정이 있나요? <b>로그인</b>
          </>
        )}
      </button>
    </div>
  );
}
