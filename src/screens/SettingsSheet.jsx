import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useApp } from '../state/AppContext';
import { PERSON_COLORS } from '../lib/meta';
import { dday } from '../lib/anniversary';
import {
  disablePush,
  enablePush,
  isPushEnabled,
  pushSupported,
} from '../lib/push';
import RecurringSheet from '../components/RecurringSheet';
import Sheet from '../components/Sheet';

export default function SettingsSheet({ onClose }) {
  const {
    profile,
    partner,
    couple,
    theme,
    setTheme,
    guard,
    toast,
    refreshCouple,
  } = useApp();
  const [name, setName] = useState(profile?.display_name || '');
  const [budgetStr, setBudgetStr] = useState(
    couple?.monthly_budget ? String(couple.monthly_budget) : '',
  );
  const [showRecurring, setShowRecurring] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    isPushEnabled().then(setPushOn);
  }, []);

  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    // 매달리면 토글이 잠기지 않게 타임아웃으로 보호
    const withTimeout = (p) =>
      Promise.race([
        p,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('요청이 지연되고 있어요. 다시 시도해주세요.')), 8000),
        ),
      ]);
    try {
      if (pushOn) {
        await withTimeout(disablePush());
        setPushOn(false);
        toast('알림을 껐어요.');
      } else {
        await withTimeout(enablePush(profile));
        setPushOn(true);
        toast('알림을 켰어요.');
      }
    } catch (e) {
      toast(e?.message || '알림 설정에 실패했어요.');
    } finally {
      setPushBusy(false);
    }
  };

  const updateCouple = async (patch, msg) => {
    const { ok } = await guard(async () => {
      const { error } = await supabase
        .from('couples')
        .update(patch)
        .eq('id', couple.id);
      if (error) throw error;
    });
    if (ok) {
      if (msg) toast(msg);
      refreshCouple();
    }
  };

  const saveAnniversary = (v) => {
    if (!v || v === couple?.anniversary) return;
    updateCouple({ anniversary: v }, '사귄 날을 기억할게요.');
  };

  const saveBudget = () => {
    const v = parseInt(budgetStr.replace(/[^0-9]/g, ''), 10) || null;
    if (v === (couple?.monthly_budget || null)) return;
    updateCouple(
      { monthly_budget: v },
      v ? '월 예산을 정했어요.' : '월 예산을 껐어요.',
    );
  };

  const saveName = async () => {
    const v = name.trim();
    if (!v || v === profile.display_name) return;
    const { ok } = await guard(async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: v })
        .eq('id', profile.id);
      if (error) throw error;
    });
    if (ok) {
      toast('이름을 바꿨어요.');
      refreshCouple();
    }
  };

  const setColor = async (color) => {
    const { ok } = await guard(async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ color })
        .eq('id', profile.id);
      if (error) throw error;
    });
    if (ok) refreshCouple();
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(couple?.invite_code || '');
      toast('초대 코드를 복사했어요.');
    } catch {
      /* noop */
    }
  };

  return (
    <>
      <Sheet onClose={onClose} label="설정">
        <div className="sheet-head">
          <span className="sheet-title">설정</span>
        </div>

        <h4>내 정보</h4>
        <div className="card">
          <div className="settings-row">
            <span className="k">이름</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              maxLength={12}
            />
          </div>
          <div className="settings-row">
            <span className="k">색 설정</span>
            <div className="color-row">
              {PERSON_COLORS.map((c) => (
                <button
                  key={c}
                  style={{ background: c }}
                  className={profile?.color === c ? 'on' : ''}
                  onClick={() => setColor(c)}
                  aria-label={`색 ${c}`}
                  disabled={partner?.color === c}
                />
              ))}
            </div>
          </div>
        </div>

        <h4>우리</h4>
        <div className="card">
          <div className="settings-row">
            <span className="k">with.</span>
            <span className="v">
              {partner ? (
                <>
                  <span
                    className="legend-dot"
                    style={{ background: partner.color }}
                  />
                  {partner.display_name}
                </>
              ) : (
                '아직 연결 전'
              )}
            </span>
          </div>
          <div className="settings-row">
            <span className="k">만난 날</span>
            <input
              type="date"
              value={couple?.anniversary || ''}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => saveAnniversary(e.target.value)}
            />
          </div>
          {couple?.anniversary && (
            <div className="settings-row">
              <span className="k">함께한 지</span>
              <span
                className="v num"
                style={{ fontWeight: 800, color: 'var(--love)' }}
              >
                D+{dday(couple.anniversary)}
              </span>
            </div>
          )}
          {!partner && (
            <div className="settings-row">
              <span className="k">초대 코드</span>
              <button
                className="v num"
                onClick={copyCode}
                style={{ fontWeight: 700, letterSpacing: '0.1em' }}
              >
                {couple?.invite_code} 복사
              </button>
            </div>
          )}
        </div>

        <h4>가계부</h4>
        <div className="card">
          <div className="settings-row">
            <span className="k">월 예산</span>
            <input
              inputMode="numeric"
              placeholder="미설정"
              value={budgetStr}
              onChange={(e) =>
                setBudgetStr(e.target.value.replace(/[^0-9]/g, ''))
              }
              onBlur={saveBudget}
              aria-label="월 예산(원)"
            />
          </div>
          <div className="settings-row">
            <span className="k">반복 일정</span>
            <button
              className="v"
              onClick={() => setShowRecurring(true)}
              style={{ fontWeight: 700 }}
            >
              관리 ›
            </button>
          </div>
        </div>

        {pushSupported() && (
          <>
            <h4>알림</h4>
            <div className="card">
              <div className="settings-row">
                <span className="k">푸시 알림</span>
                <button
                  type="button"
                  className={`toggle ${pushOn ? 'on' : ''}`}
                  onClick={togglePush}
                  disabled={pushBusy}
                  aria-pressed={pushOn}
                  aria-label="푸시 알림"
                />
              </div>
              <div className="settings-row">
                <span
                  className="k"
                  style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}
                >
                  상대의 일정·가계부 추가, 일정 전날 알림을 받아요.
                </span>
              </div>
            </div>
          </>
        )}

        <h4>화면</h4>
        <div className="card" style={{ padding: 12 }}>
          <div className="seg">
            {[
              ['light', '라이트'],
              ['system', '시스템'],
              ['dark', '다크'],
            ].map(([v, l]) => (
              <button
                key={v}
                className={theme === v ? 'on' : ''}
                onClick={() => setTheme(v)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn danger"
          style={{ marginTop: 16 }}
          onClick={() => supabase.auth.signOut()}
        >
          로그아웃
        </button>
      </Sheet>
      {showRecurring && (
        <RecurringSheet onClose={() => setShowRecurring(false)} />
      )}
    </>
  );
}
