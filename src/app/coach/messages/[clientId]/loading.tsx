export default function Loading() {
  return (
    <div className="coach-page flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="animate-pulse rounded-full" style={{ width: 40, height: 40, backgroundColor: '#1A1A1A' }} />
        <div className="animate-pulse" style={{ width: 140, height: 20, backgroundColor: '#1A1A1A', borderRadius: 6 }} />
      </div>

      {/* Message bubbles */}
      <div className="flex flex-col gap-3 flex-1 overflow-hidden">
        {[80, 60, 90, 50, 70].map((w, i) => (
          <div key={i} className="flex" style={{ justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end' }}>
            <div
              className="animate-pulse"
              style={{
                width: `${w}%`,
                maxWidth: 320,
                height: 48,
                backgroundColor: '#1A1A1A',
                borderRadius: 14,
              }}
            />
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div className="animate-pulse mt-4" style={{ height: 48, backgroundColor: '#1A1A1A', borderRadius: 12 }} />
    </div>
  )
}
