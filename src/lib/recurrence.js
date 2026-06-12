import { addMonths, format, lastDayOfMonth } from 'date-fns'
import { supabase } from './supabase'

// day_of_month 31 은 '말일' — 짧은 달에서도 항상 마지막 날에 매칭됨
export const LAST_DAY = 31

export function ruleDayLabel(day) {
  return day === LAST_DAY ? '말일' : `매월 ${day}일`
}

// 규칙의 도래일: starts_on 이후, last_run_on 초과, 오늘 이하
export function dueDates(rule, today = new Date()) {
  const start = new Date(rule.starts_on + 'T00:00')
  const floor = rule.last_run_on ? new Date(rule.last_run_on + 'T00:00') : null
  const out = []
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  while (cursor <= thisMonth) {
    const day = Math.min(rule.day_of_month, lastDayOfMonth(cursor).getDate())
    const d = new Date(cursor.getFullYear(), cursor.getMonth(), day)
    if (d >= start && (!floor || d > floor) && d <= today) out.push(format(d, 'yyyy-MM-dd'))
    cursor = addMonths(cursor, 1)
  }
  return out
}

// 아직 생성되지 않은 미래 도래일 미리보기: 'yyyy-MM-dd' -> { expense, income }
// 오늘까지는 runRecurringRules 가 실제 내역을 만들므로 내일부터만 계산한다.
export function upcomingPreviews(rules, rangeStart, rangeEnd, today = new Date()) {
  const map = {}
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const from = tomorrow > rangeStart ? tomorrow : rangeStart
  if (from > rangeEnd) return map
  for (const r of rules) {
    const start = new Date(r.starts_on + 'T00:00')
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1)
    const endMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1)
    while (cursor <= endMonth) {
      const day = Math.min(r.day_of_month, lastDayOfMonth(cursor).getDate())
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), day)
      if (d >= from && d <= rangeEnd && d >= start) {
        const k = format(d, 'yyyy-MM-dd')
        if (!map[k]) map[k] = { expense: 0, income: 0 }
        map[k][r.type] += r.amount
      }
      cursor = addMonths(cursor, 1)
    }
  }
  return map
}

// 앱이 열릴 때 호출: 도래한 규칙으로 거래를 만들어 넣는다.
// 둘이 동시에 열어도 (recurring_rule_id, date) unique 인덱스가 중복을 막는다.
export async function runRecurringRules(coupleId) {
  const today = new Date()
  const { data: rules, error } = await supabase
    .from('recurring_rules')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('active', true)
  if (error || !rules?.length) return 0

  const rows = rules.flatMap((r) =>
    dueDates(r, today).map((date) => ({
      couple_id: coupleId,
      recurring_rule_id: r.id,
      type: r.type,
      amount: r.amount,
      category: r.category,
      memo: r.memo,
      date,
      created_by: r.created_by,
    }))
  )
  if (rows.length) {
    const { error: insertError } = await supabase
      .from('transactions')
      .upsert(rows, { onConflict: 'recurring_rule_id,date', ignoreDuplicates: true })
    if (insertError) return 0
  }
  await supabase
    .from('recurring_rules')
    .update({ last_run_on: format(today, 'yyyy-MM-dd') })
    .eq('couple_id', coupleId)
    .eq('active', true)
  return rows.length
}
