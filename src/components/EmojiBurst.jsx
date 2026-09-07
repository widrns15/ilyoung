import { useMemo } from 'react'
import { createPortal } from 'react-dom'

// 특별한 날 바텀시트가 열릴 때 이모지가 화면 아래에서 팡팡 튀어오르는 1회성 효과
export default function EmojiBurst({ emojis, count = 18 }) {
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        e: emojis[i % emojis.length],
        left: 4 + Math.random() * 92, // vw
        delay: Math.random() * 0.6, // s
        dur: 1.2 + Math.random() * 1.0, // s
        size: 18 + Math.random() * 24, // px
        drift: Math.round(-60 + Math.random() * 120), // px 좌우 흔들림
        rot: Math.round(-30 + Math.random() * 60), // deg
      })),
    [emojis, count],
  )

  return createPortal(
    <div className="emoji-burst" aria-hidden>
      {parts.map((p) => (
        <span
          key={p.id}
          style={{
            left: `${p.left}vw`,
            fontSize: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            '--drift': `${p.drift}px`,
            '--rot': `${p.rot}deg`,
          }}
        >
          {p.e}
        </span>
      ))}
    </div>,
    document.body,
  )
}
