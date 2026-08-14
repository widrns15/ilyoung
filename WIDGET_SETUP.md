# 아이폰 위젯 설정 (Scriptable)

PWA는 iOS 위젯을 직접 만들 수 없어, 무료 앱 **Scriptable**로 우리 일정 위젯을 띄웁니다.
서버는 기존 Supabase의 Edge Function 하나(`widget-feed`)만 추가 — 비용 0원.

## 1. 위젯 토큰 만들기

아무 긴 랜덤 문자열이면 됩니다. 터미널에서:

```bash
node -e "console.log(crypto.randomUUID() + crypto.randomUUID())"
```

## 2. couple_id 확인

Supabase SQL Editor에서:

```sql
select id from couples;
```

## 3. 시크릿 등록 + 함수 배포

```bash
npx supabase secrets set WIDGET_TOKEN=<1의 토큰> WIDGET_COUPLE_ID=<2의 id> --project-ref vgagjffjwrjhkjkqopxw
npx supabase functions deploy widget-feed --no-verify-jwt --project-ref vgagjffjwrjhkjkqopxw
```

동작 확인 (JSON이 나오면 성공):

```
https://vgagjffjwrjhkjkqopxw.functions.supabase.co/widget-feed?token=<토큰>
```

## 4. 폰에 설치 (둘 다 각자 1회)

1. App Store에서 **Scriptable** 설치 (무료)
2. Scriptable 열기 → `+` → `scriptable/onezero-widget.js` 내용 전체 붙여넣기
3. 맨 위 `FEED_URL`의 `여기에_WIDGET_TOKEN`을 1의 토큰으로 교체 → 이름 `1+0`으로 저장
4. **홈 화면 위젯**: 홈 화면 길게 누름 → `+` → Scriptable → 크기 선택 → 위젯 길게 눌러 편집 → Script = `1+0`
5. **잠금화면 위젯**: 잠금화면 길게 누름 → 사용자화 → 위젯 추가 → Scriptable → Script = `1+0`

## 표시 내용

- 헤더: `1+0` + `💞 D+N`
- 다가오는 일정(실제 + 🔁반복) 최대 2~8개: `오늘/내일/N일 뒤/M.d · 제목`
- 오프라인이거나 서버 실패 시 마지막 성공 데이터 표시

## 참고

- 갱신 주기: 스크립트는 30분마다 갱신을 요청하지만, 실제 시점은 iOS가 배터리 상황 보고 결정(보통 15분~1시간).
- 토큰이 유출되면 일정이 노출되므로 URL을 남에게 공유하지 마세요. 유출 시 `WIDGET_TOKEN`만 새로 set 하면 됩니다.
