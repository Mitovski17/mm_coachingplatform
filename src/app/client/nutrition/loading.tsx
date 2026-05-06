export default function Loading() {
  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 8px' }}>
      {/* Header + plan type toggle */}
      <div className="flex items-center justify-between" style={{ padding: '52px 20px 12px' }}>
        <div
          className="animate-pulse"
          style={{ width: 120, height: 28, backgroundColor: '#1A1A1A', borderRadius: 8 }}
        />
        <div
          className="animate-pulse"
          style={{ width: 120, height: 30, backgroundColor: '#1A1A1A', borderRadius: 999 }}
        />
      </div>

      {/* Week strip */}
      <div style={{ padding: '0 16px 12px' }}>
        <div
          className="animate-pulse rounded-xl"
          style={{ height: 56, backgroundColor: '#1A1A1A', border: '1px solid var(--color-border)' }}
        />
      </div>

      {/* Calories card */}
      <div style={{ padding: '0 16px 10px' }}>
        <div
          className="animate-pulse rounded-xl"
          style={{ height: 80, backgroundColor: '#1A1A1A', border: '1px solid var(--color-border)' }}
        />
      </div>

      {/* Macro bars */}
      <div style={{ padding: '0 16px 16px' }}>
        <div
          className="animate-pulse rounded-xl"
          style={{ height: 70, backgroundColor: '#1A1A1A', border: '1px solid var(--color-border)' }}
        />
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 16px 12px' }}>
        <div
          className="animate-pulse"
          style={{ width: 120, height: 32, backgroundColor: '#1A1A1A', borderRadius: 999 }}
        />
      </div>

      {/* Meal cards */}
      <div className="flex flex-col gap-3" style={{ padding: '0 16px 16px' }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl"
            style={{ height: 100, backgroundColor: '#1A1A1A', border: '1px solid var(--color-border)' }}
          />
        ))}
      </div>
    </div>
  )
}
