export default function Loading() {
  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 8px' }}>
      {/* Header */}
      <div style={{ padding: '52px 20px 16px' }}>
        <div
          className="animate-pulse"
          style={{ width: 140, height: 28, backgroundColor: '#1A1A1A', borderRadius: 8 }}
        />
      </div>

      {/* Chart area */}
      <div style={{ padding: '0 16px 16px' }}>
        <div
          className="animate-pulse rounded-xl"
          style={{ height: 220, backgroundColor: '#1A1A1A', border: '1px solid var(--color-border)' }}
        />
      </div>

      {/* Stats grid */}
      <div style={{ padding: '0 16px 16px' }}>
        <div
          className="animate-pulse"
          style={{ width: 100, height: 12, backgroundColor: '#1A1A1A', borderRadius: 4, marginBottom: 12 }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl"
              style={{ height: 80, backgroundColor: '#1A1A1A', border: '1px solid var(--color-border)' }}
            />
          ))}
        </div>
      </div>

      {/* Progress rows */}
      <div className="flex flex-col gap-3" style={{ padding: '0 16px 16px' }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl"
            style={{ height: 64, backgroundColor: '#1A1A1A', border: '1px solid var(--color-border)' }}
          />
        ))}
      </div>
    </div>
  )
}
