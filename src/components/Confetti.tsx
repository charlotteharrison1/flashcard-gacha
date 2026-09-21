import { useState, type CSSProperties } from 'react'

const COLORS = ['#ff4d40', '#ffc233', '#1e9bff', '#3ed598', '#ff9430', '#f4ecd8']

export default function Confetti({ count = 70 }: { count?: number }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      duration: 2.2 + Math.random() * 2,
      delay: Math.random() * 0.8,
    })),
  )

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{ left: `${p.left}%`, background: p.color, '--d': `${p.duration}s`, '--delay': `${p.delay}s` } as CSSProperties}
        />
      ))}
    </div>
  )
}
