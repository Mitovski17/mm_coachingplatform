export default function Loading() {
  return (
    <div className="coach-page flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="cx-skel rounded-full" style={{ width: 40, height: 40, backgroundColor: 'var(--color-surface-2)' }} />
        <div className="cx-skel" style={{ width: 140, height: 20, backgroundColor: 'var(--color-surface-2)', borderRadius: 6 }} />
      </div>

      {/* Message bubbles */}
      <div className="flex flex-col gap-3 flex-1 overflow-hidden">
        {[80, 60, 90, 50, 70].map((w, i) => (
          <div key={i} className="flex" style={{ justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end' }}>
            <div
              className="cx-skel"
              style={{
                width: `${w}%`,
                maxWidth: 320,
                height: 48,
                backgroundColor: 'var(--color-surface-2)',
                borderRadius: 14,
              }}
            />
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div className="cx-skel mt-4" style={{ height: 48, backgroundColor: 'var(--color-surface-2)', borderRadius: 12 }} />
    </div>
  )
}
