export const EXPENSE_CATEGORIES = [
  { name: '식비', emoji: '🍚' },
  { name: '카페', emoji: '☕' },
  { name: '데이트', emoji: '💐' },
  { name: '교통', emoji: '🚇' },
  { name: '쇼핑', emoji: '🛍️' },
  { name: '문화', emoji: '🎬' },
  { name: '여행', emoji: '✈️' },
  { name: '의료', emoji: '💊' },
  { name: '주거/통신', emoji: '🏠' },
  { name: '경조사', emoji: '💌' },
  { name: '기타', emoji: '🧾' },
]

export const INCOME_CATEGORIES = [
  { name: '월급', emoji: '💼' },
  { name: '용돈', emoji: '🪙' },
  { name: '이자/배당', emoji: '🏦' },
  { name: '기타', emoji: '🧾' },
]

export const PERSON_COLORS = [
  '#F2685C', '#4D7CFE', '#18A36C', '#E8A23D',
  '#9B6BD4', '#E45C9C', '#2BA8A0', '#7A828E',
]

export function categoryEmoji(type, name) {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  return list.find((c) => c.name === name)?.emoji ?? '🧾'
}

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
