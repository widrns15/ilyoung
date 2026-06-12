import { useEffect, useRef, useState } from 'react'

// 공용 바텀 시트: 딤 탭 또는 아래로 쓸어내려서 닫기
export default function Sheet({ onClose, label, children }) {
  const ref = useRef(null)
  const drag = useRef(null) // { y, t, id, active }
  const [dy, setDy] = useState(0)
  const [settling, setSettling] = useState(false)

  const onPointerDown = (e) => {
    if (e.button) return
    if (e.target.closest('input, select, textarea')) return
    drag.current = { y: e.clientY, t: Date.now(), id: e.pointerId, active: false }
  }

  const onPointerMove = (e) => {
    const d = drag.current
    if (!d || settling) return
    const delta = e.clientY - d.y
    if (!d.active) {
      // 위로 긁거나 내용이 스크롤된 상태면 일반 스크롤로 넘김
      if (delta > 14 && ref.current.scrollTop <= 0) {
        d.active = true
        try { ref.current.setPointerCapture(d.id) } catch { /* noop */ }
      } else if (Math.abs(delta) > 14) {
        drag.current = null
      }
      return
    }
    setDy(Math.max(0, delta))
  }

  const onPointerEnd = (e) => {
    const d = drag.current
    drag.current = null
    if (!d?.active) return
    const delta = Math.max(0, e.clientY - d.y)
    const velocity = delta / Math.max(Date.now() - d.t, 1)
    if (delta > 120 || velocity > 0.55) {
      onClose()
    } else {
      setSettling(true)
      setDy(0)
    }
  }

  // 드래그 중 브라우저 스크롤/당겨서 새로고침 차단
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const prevent = (e) => { if (drag.current?.active) e.preventDefault() }
    el.addEventListener('touchmove', prevent, { passive: false })
    return () => el.removeEventListener('touchmove', prevent)
  }, [])

  const dragging = drag.current?.active || dy > 0
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={ref}
        className="sheet"
        role="dialog"
        aria-label={label}
        style={
          dragging || settling
            ? {
                transform: `translate(-50%, ${dy}px)`,
                transition: settling ? 'transform 0.2s ease' : 'none',
              }
            : undefined
        }
        onTransitionEnd={() => setSettling(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <div className="sheet-handle" />
        {children}
      </div>
    </>
  )
}
