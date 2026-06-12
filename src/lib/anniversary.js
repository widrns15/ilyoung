import { addDays, addYears, differenceInCalendarDays, format } from 'date-fns'

// 사귄 날을 1일로 세는 한국식 디데이 (사귄 날 = D+1)
export function dday(anniversary, today = new Date()) {
  return differenceInCalendarDays(today, new Date(anniversary + 'T00:00')) + 1
}

// 보이는 범위 안의 기념일 라벨: 'yyyy-MM-dd' -> '300일' | '2주년' | '시작한 날'
export function anniversaryMarks(anniversary, rangeStart, rangeEnd) {
  const base = new Date(anniversary + 'T00:00')
  const marks = {}
  if (base >= rangeStart && base <= rangeEnd) marks[format(base, 'yyyy-MM-dd')] = '시작한 날'
  for (let n = 100; n <= 36500; n += 100) {
    const d = addDays(base, n - 1)
    if (d > rangeEnd) break
    if (d >= rangeStart) marks[format(d, 'yyyy-MM-dd')] = `${n}일`
  }
  for (let y = 1; y <= 100; y++) {
    const d = addYears(base, y)
    if (d > rangeEnd) break
    if (d >= rangeStart) marks[format(d, 'yyyy-MM-dd')] = `${y}주년`
  }
  return marks
}
