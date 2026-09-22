# 1+0 — 일과 영의 이야기

둘이 쓰는 캘린더 가계부 PWA. 일정과 지출을 하나의 캘린더에서 함께 관리하고,
두 사람이 실시간으로 같은 데이터를 봅니다.

## 기능

- 통합 캘린더: 일정 + 일별 지출/수입 합계를 풀블리드 한 화면에.
  여러 날짜에 걸친 일정은 칸을 가로지르는 하나의 연결 막대로 표시
- 하단 탭으로 통합 / 일정만 / 가계부만 뷰 전환,
  좌우 스와이프로 월 이동(방향 슬라이드 전환)
- 일정은 날짜 단위(하루~여러 날), 시트에서 꾹 눌러 같은 날 일정 순서 변경
- 일정 막대를 꾹 누르면 드래그로 다른 날 이동 또는 휴지통에 끌어 삭제.
  날짜 시트의 일정을 시트 위로 끌어내면 캘린더가 드러나며 원하는 날짜에 드롭해 이동
  — 드래그 중 화면 가장자리에 잠시 머무르면 이전/다음 달로 넘어감
- 날짜 시트의 카드(일정/가계부)를 눌러 바로 추가
- 특별한 날(기념일 마일스톤, 지정 날짜) 시트를 열면 이모지가 튀어오르는 효과
  (`src/screens/Shell.jsx` 의 `SPECIAL_BURSTS` 에서 날짜·이모지 지정)
- 일정 ↔ 지출 연결: 지출 입력 시 그날 일정을 선택하면, 일정에서 쓴 돈이 모아 보임
- 반복 등록: 일정·내역 추가 시트 우상단 🔁 로 매월/매년(일정)·매월(거래) 규칙 생성.
  캘린더에 흐리게 미리 표시되고, 눌러서 내용 확인(읽기전용).
  관리(켜기/끄기·수정·삭제)는 설정 > 반복 일정
- 웹 푸시 알림: 상대가 일정/내역을 추가하면 즉시, 전날 아침엔 리마인더 —
  일정·반복 일정·기념일 마일스톤(100일 단위, n주년) 모두
  (설정 > 알림 토글 · 세팅은 `PUSH_SETUP.md`)
- 가계부 리마인드: 일요일 저녁 **주말 결산**(이번 주 지출·지난주 대비·최다 분류),
  5일간 기록이 없으면 **미기록 리마인드**(5일마다, 30일까지) — 설정에서 각각 on/off
- 아이폰 위젯: Scriptable 로 홈/잠금화면에 D-day 와 다가오는 일정 표시
  (세팅은 `WIDGET_SETUP.md`)
- 월 예산: 예산을 정하면 캘린더 위에 남은 금액과 진행률 바 표시
- 디데이·기념일: 사귄 날 등록 시 헤더에 D+N, 캘린더에 100일 단위·n주년 자동 표시
- 커플 연결: 한 명이 초대 코드 생성 → 상대방이 입력 (최대 2명)
- 실시간 동기화: 상대방이 입력하면 내 화면에 바로 반영
- 월별 통계: 지출/수입 합계, 분류별 지출(전월 대비 증감), 사람별 지출 비율,
  최근 6개월 지출 그래프, 월간 한 줄 요약,
  함께한 일정 기록(전체 화면 페이지 + 제목·메모 검색)
- 한국 법정공휴일 표시 (2025–2027 내장, `src/lib/holidays.js`에서 수정)
- 다크모드 (시스템/라이트/다크), 작성자별 개인 색상
- 오프라인이면 저장 시도 시 안내 토스트 표시
- PWA: 홈 화면에 설치해 앱처럼 사용. 저장된 세션+캐시로 네트워크 없이도 즉시 부팅

## 시작하기 (약 10분)

### 1. Supabase 프로젝트 만들기

1. https://supabase.com 에서 무료 프로젝트 생성 (리전: Northeast Asia (Seoul) 추천)
2. 좌측 **SQL Editor** → `supabase/schema.sql` 내용 전체를 붙여넣고 **Run**
   (이미 운영 중인 DB는 `supabase/migration-00N-*.sql` 중 아직 안 돌린 것만 순서대로 Run)
3. **Authentication > Sign In / Up > Email** 에서 **Confirm email 을 끄면**
   가입 즉시 로그인됩니다 (둘이서만 쓰는 앱이라 꺼도 무방. 켜두면 메일 인증 후 로그인)
4. **Settings > API** 에서 `Project URL` 과 `anon public` 키를 복사

### 2. 로컬 실행

```bash
npm install
cp .env.example .env   # 복사한 URL과 키를 .env 에 입력
npm run dev
```

### 3. 배포 (Vercel 기준)

1. 이 폴더를 GitHub에 푸시
2. https://vercel.com 에서 Import → Framework: Vite 자동 감지
3. Environment Variables 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_VAPID_PUBLIC_KEY`(푸시용, `PUSH_SETUP.md` 참고) 추가 → Deploy

PWA(서비스 워커)는 HTTPS에서만 동작하는데, Vercel은 기본 HTTPS라 추가 설정이 없습니다.
Netlify, Cloudflare Pages도 동일하게 동작합니다.

### 4. 폰에 설치

- **iPhone**: Safari로 배포 주소 접속 → 공유 버튼 → **홈 화면에 추가**
  (푸시 알림은 홈 화면 추가된 앱에서만 동작)
- **Android**: Chrome 접속 → 메뉴 → **앱 설치**

### 5. 둘이 연결하기

각자 가입 → 한 명이 "초대 코드 만들기" → 코드를 상대에게 전송 → 상대가 입력하면 끝.

### 6. 선택 세팅

- **푸시 알림**(파트너 활동 + 일정 전날 + 가계부 리마인드): `PUSH_SETUP.md`
  — VAPID 키, `migration-004`/`005`, Edge Function `notify`/`event-reminders`/`ledger-reminders`, pg_cron
- **아이폰 위젯**: `WIDGET_SETUP.md`
  — Edge Function `widget-feed` + Scriptable 스크립트(`scriptable/onezero-widget.js`)

## 구조

```
supabase/schema.sql       # 테이블 + RLS + 커플 연결 함수 (신규 설치는 여기 하나)
supabase/migration-00N-*  # 기존 DB용 마이그레이션 (001 반복거래/예산/기념일,
                          # 002 반복 일정, 003 일정 순서, 004 푸시 구독)
supabase/functions/       # Edge Functions: notify(파트너 알림),
                          # event-reminders(전날 알림), ledger-reminders(주말 결산·미기록 리마인드)
                          #   — 둘 다 _cron.sql 로 스케줄, widget-feed(위젯 데이터)
scriptable/               # 아이폰 위젯 스크립트 (Scriptable 용)
public/push-sw.js         # 서비스워커 푸시 수신 핸들러
src/
  state/AppContext.jsx    # 세션, 프로필, 테마, 토스트, 오프라인 가드, 캐시 즉시 부팅
  state/useCoupleData.js  # 월 단위 데이터 로드 + 실시간 구독
  screens/                # Auth, Pair(커플 연결), Shell(메인), Stats, Settings
  components/             # CalendarGrid(주 단위 막대 오버레이), DaySheet, EventModal,
                          # TxModal, Sheet(공용 바텀 시트), RecurringSheet,
                          # EventHistoryPage(일정 기록 + 검색), EmojiBurst(특별한 날 효과)
  lib/                    # supabase 클라이언트, 카테고리/포맷, 공휴일, push(웹 푸시),
                          # recurrence(반복 규칙), anniversary(디데이)
```

## 보안 메모

- 모든 데이터 접근은 Postgres RLS로 강제됩니다. 클라이언트가 조작돼도
  자기 커플의 데이터만 읽고 쓸 수 있습니다.
- `anon` 키는 공개되어도 되는 키입니다 (RLS가 권한을 통제).
- 커플 연결/생성은 `security definer` RPC로만 가능하고, 한 커플은 2명까지입니다.
- 푸시 발송·위젯 피드는 Edge Function 이 service_role 로 수행하며,
  VAPID 비밀키·위젯 토큰은 Supabase 시크릿에만 둡니다 (레포에 커밋 금지).

## 커스터마이즈

- 지출 카테고리: `src/lib/meta.js` 의 `EXPENSE_CATEGORIES` (수입은 분류 없음)
- 개인 색상 팔레트: 같은 파일의 `PERSON_COLORS`
- 공휴일: `src/lib/holidays.js` (2028년 이후는 직접 추가)
- 앱 이름/아이콘: `vite.config.js` 의 manifest, `public/icons/`
- 알림 문구·발송 시각: `supabase/functions/*`, cron 은 `_cron.sql`
