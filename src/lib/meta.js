export const EXPENSE_CATEGORIES = [
  { name: '데이트', emoji: '💐' },
  { name: '여행', emoji: '✈️' },
  { name: '경조사', emoji: '💌' },
  { name: '기타', emoji: '🧾' },
]

// 수입은 분류를 두지 않는다 (category 컬럼은 '기타'로 저장)
export const INCOME_CATEGORIES = []

export const PERSON_COLORS = [
  '#F2685C', '#4D7CFE', '#18A36C', '#E8A23D',
  '#9B6BD4', '#E45C9C', '#2BA8A0', '#7A828E',
]

export function categoryEmoji(type, name) {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  return list.find((c) => c.name === name)?.emoji ?? '🧾'
}

// 터치 기기에선 시트가 열리자마자 키보드가 화면을 밀어올리므로 자동 포커스를 끈다
export const canAutoFocus = () =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches

export function won(n) {
  return new Intl.NumberFormat('ko-KR').format(n)
}

export function compactWon(n) {
  if (n >= 100000000) return `${trimZero(n / 100000000)}억`
  if (n >= 10000) return `${trimZero(n / 10000)}만`
  if (n >= 1000) return `${trimZero(n / 1000)}천`
  return String(n)
}

function trimZero(v) {
  const r = Math.round(v * 10) / 10
  return r % 1 === 0 ? String(Math.round(r)) : r.toFixed(1)
}
