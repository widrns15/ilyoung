// 1+0 — 아이폰 홈/잠금화면 위젯 (Scriptable 용)
// 사용법: WIDGET_SETUP.md 참고. 아래 FEED_URL 만 본인 값으로 바꾸면 됩니다.

const FEED_URL =
  'https://vgagjffjwrjhkjkqopxw.functions.supabase.co/widget-feed?token=여기에_WIDGET_TOKEN'

// ── 앱과 같은 색 ───────────────────────────────────────────
const C = {
  bg: Color.dynamic(new Color('#f5f6f8'), new Color('#121417')),
  ink: Color.dynamic(new Color('#1a1c20'), new Color('#eceef1')),
  muted: Color.dynamic(new Color('#9aa1ab'), new Color('#6e7681')),
  love: Color.dynamic(new Color('#e0509a'), new Color('#ff8cc2')),
}

// ── 데이터 (실패 시 마지막 성공 응답 사용) ─────────────────
const fm = FileManager.local()
const cachePath = fm.joinPath(fm.cacheDirectory(), 'onezero-widget.json')

async function loadFeed() {
  try {
    const data = await new Request(FEED_URL).loadJSON()
    fm.writeString(cachePath, JSON.stringify(data))
    return data
  } catch (e) {
    if (fm.fileExists(cachePath)) return JSON.parse(fm.readString(cachePath))
    throw e
  }
}

const DAY = 86400000
function label(ev, todayStr) {
  const today = new Date(todayStr + 'T00:00:00Z')
  const start = new Date(ev.date + 'T00:00:00Z')
  const end = ev.end ? new Date(ev.end + 'T00:00:00Z') : start
  if (start <= today && today <= end) return 'D-Day'
  return `D-${Math.round((start - today) / DAY)}`
}

function eventLine(w, ev, todayStr, size) {
  const row = w.addStack()
  row.centerAlignContent()
  const when = row.addText(label(ev, todayStr))
  when.font = Font.mediumSystemFont(size)
  when.textColor = C.muted
  row.addSpacer(6)
  const title = row.addText((ev.recurring ? '🔁 ' : '') + ev.title)
  title.font = Font.mediumSystemFont(size)
  title.textColor = C.ink
  title.lineLimit = 1
}

async function build() {
  const feed = await loadFeed()
  const w = new ListWidget()
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000)
  const fam = config.widgetFamily || 'medium'

  // 잠금화면(사각형): 텍스트만 간결하게
  if (fam === 'accessoryRectangular') {
    if (feed.dday) {
      const t = w.addText(`💞 D+${feed.dday}`)
      t.font = Font.boldSystemFont(13)
    }
    for (const ev of feed.events.slice(0, 2)) {
      const t = w.addText(`${label(ev, feed.today)} · ${ev.title}`)
      t.font = Font.mediumSystemFont(12)
      t.lineLimit = 1
    }
    return w
  }
  // 잠금화면(원형 1x1): D-day 만 간결하게
  if (fam === 'accessoryCircular') {
    w.addSpacer()
    const r1 = w.addStack()
    r1.addSpacer()
    const heart = r1.addText('💞')
    heart.font = Font.systemFont(11)
    r1.addSpacer()
    const r2 = w.addStack()
    r2.addSpacer()
    const t = r2.addText(feed.dday ? `D+${feed.dday}` : '1+0')
    t.font = Font.boldSystemFont(12)
    t.minimumScaleFactor = 0.6
    t.lineLimit = 1
    r2.addSpacer()
    w.addSpacer()
    return w
  }
  // 잠금화면(한 줄)
  if (fam === 'accessoryInline') {
    const next = feed.events[0]
    w.addText(
      next ? `💞 ${label(next, feed.today)} ${next.title}` : `💞 D+${feed.dday ?? ''}`,
    )
    return w
  }

  // 홈 화면
  w.backgroundColor = C.bg
  w.setPadding(14, 16, 14, 16)

  const small = fam === 'small'
  const head = w.addStack()
  head.centerAlignContent()
  const logo = head.addText('1+0')
  logo.font = Font.heavySystemFont(small ? 12 : 14)
  logo.textColor = C.ink
  head.addSpacer()
  if (feed.dday) {
    const dd = head.addText(`💞 D+${feed.dday}`)
    dd.font = Font.boldSystemFont(small ? 11 : 13)
    dd.textColor = C.love
  }
  w.addSpacer(8)

  const max = small ? 4 : fam === 'large' ? 8 : 5
  const size = fam === 'small' ? 11 : 13
  const list = feed.events.slice(0, max)
  if (list.length === 0) {
    const t = w.addText('다가오는 일정이 없어요')
    t.font = Font.mediumSystemFont(size)
    t.textColor = C.muted
  }
  for (const ev of list) {
    eventLine(w, ev, feed.today, size)
    w.addSpacer(4)
  }
  w.addSpacer()
  return w
}

const widget = await build()
if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentMedium()
}
Script.complete()
