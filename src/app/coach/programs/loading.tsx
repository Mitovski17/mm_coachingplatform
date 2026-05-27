export default function Loading() {
  return (
    <div className="coach-page">
      {/* Page title + action button */}
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div
          className="animate-pulse"
          style={{ width: 140, height: 28, backgroundColor: '#1A1A1A', borderRadius: 8 }}
        />
        <div
          className="animate-pulse"
          style={{ width: 120, height: 36, backgroundColor: '#1A1A1A', borderRadius: 8 }}
        />
      </div>

      {/* Two-column list */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left column — templates */}
        <div>
          <div
            className="animate-pulse"
            style={{ width: 90, height: 12, backgroundColor: '#1A1A1A', borderRadius: 4, marginBottom: 10 }}
          />
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl"
                style={{ height: 68, backgroundColor: '#1A1A1A', border: '1px solid var(--color-border)' }}
              />
            ))}
          </div>
        </div>

        {/* Right column — programs */}
        <div>
          <div
            className="animate-pulse"
            style={{ width: 90, height: 12, backgroundColor: '#1A1A1A', borderRadius: 4, marginBottom: 10 }}
          />
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl"
                style={{ height: 68, backgroundColor: '#1A1A1A', border: '1px solid var(--color-border)' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
