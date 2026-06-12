# 1+0 — 일과 영의 이야기

둘이 쓰는 캘린더 가계부 PWA. 일정과 지출을 하나의 캘린더에서 함께 관리하고,
두 사람이 실시간으로 같은 데이터를 봅니다.

## 기능

- 통합 캘린더: 일정(작성자 색상 칩) + 일별 지출/수입 합계를 한 화면에
- 하단 탭으로 통합 / 일정만 / 가계부만 뷰 전환, 좌우 스와이프로 월 이동
- 일정 ↔ 지출 연결: 지출 입력 시 그날 일정을 선택하면, 일정에서 쓴 돈이 모아 보임
- 반복 거래: 매월 지정일(또는 말일)에 거래 자동 생성 — 월세, 통신비, 데이트 통장 입금
- 월 예산: 예산을 정하면 캘린더 위에 남은 금액과 진행률 바 표시
- 디데이·기념일: 사귄 날 등록 시 헤더에 D+N, 캘린더에 100일 단위·n주년 자동 표시
- 커플 연결: 한 명이 초대 코드 생성 → 상대방이 입력 (최대 2명)
- 실시간 동기화: 상대방이 입력하면 내 화면에 바로 반영
- 월별 통계: 지출/수입 합계, 분류별 지출(전월 대비 증감), 사람별 지출 비율,
  최근 6개월 지출 그래프, 월간 한 줄 요약, 함께한 일정 기록(월별 모아 보기)
- 일정 칩을 꾹 누르면 드래그로 다른 날 이동 또는 휴지통에 끌어 삭제
- 모든 바텀 시트는 아래로 쓸어내려 닫기
- 한국 법정공휴일 표시 (2025–2027 내장, `src/lib/holidays.js`에서 수정)
- 다크모드 (시스템/라이트/다크), 작성자별 개인 색상
- 오프라인이면 저장 시도 시 안내 토스트 표시
- PWA: 홈 화면에 설치해 앱처럼 사용, 재방문 시 로컬 캐시로 빠른 부팅

## 시작하기 (약 10분)

### 1. Supabase 프로젝트 만들기

1. https://supabase.com 에서 무료 프로젝트 생성 (리전: Northeast Asia (Seoul) 추천)
2. 좌측 **SQL Editor** → `supabase/schema.sql` 내용 전체를 붙여넣고 **Run**
   (이미 운영 중인 DB에 반복 거래/예산/기념일 기능만 추가하려면
   `supabase/migration-001-recurring-budget-anniversary.sql` 만 Run)
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
3. Environment Variables 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가 → Deploy

PWA(서비스 워커)는 HTTPS에서만 동작하는데, Vercel은 기본 HTTPS라 추가 설정이 없습니다.
Netlify, Cloudflare Pages도 동일하게 동작합니다.

### 4. 폰에 설치

- **iPhone**: Safari로 배포 주소 접속 → 공유 버튼 → **홈 화면에 추가**
- **Android**: Chrome 접속 → 메뉴 → **앱 설치**

### 5. 둘이 연결하기

각자 가입 → 한 명이 "초대 코드 만들기" → 코드를 상대에게 전송 → 상대가 입력하면 끝.

## 구조

```
supabase/schema.sql      # 테이블 + RLS + 커플 연결 함수 (신규 설치는 여기 하나)
supabase/migration-001-* # 기존 DB용 반복 거래/예산/기념일 마이그레이션
src/
  state/AppContext.jsx   # 세션, 프로필, 테마, 토스트, 오프라인 가드, 부팅 캐시
  state/useCoupleData.js # 월 단위 데이터 로드 + 실시간 구독
  screens/               # Auth, Pair(커플 연결), Shell(메인), Stats, Settings
  components/            # CalendarGrid, DaySheet, EventModal, TxModal,
                         # Sheet(공용 바텀 시트), RecurringSheet, EventHistorySheet
  lib/                   # supabase 클라이언트, 카테고리/포맷, 공휴일,
                         # recurrence(반복 거래), anniversary(디데이)
```

## 보안 메모

- 모든 데이터 접근은 Postgres RLS로 강제됩니다. 클라이언트가 조작돼도
  자기 커플의 데이터만 읽고 쓸 수 있습니다.
- `anon` 키는 공개되어도 되는 키입니다 (RLS가 권한을 통제).
- 커플 연결/생성은 `security definer` RPC로만 가능하고, 한 커플은 2명까지입니다.

## 커스터마이즈

- 카테고리: `src/lib/meta.js` 의 `EXPENSE_CATEGORIES` / `INCOME_CATEGORIES`
- 개인 색상 팔레트: 같은 파일의 `PERSON_COLORS`
- 공휴일: `src/lib/holidays.js` (2028년 이후는 직접 추가)
- 앱 이름/아이콘: `vite.config.js` 의 manifest, `public/icons/`
