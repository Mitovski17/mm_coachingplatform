export default function Loading() {
  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 8px' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: '52px 20px 20px' }}>
        <div>
          <div
            className="animate-pulse"
            style={{ width: 210, height: 32, backgroundColor: 'var(--color-surface-3)', borderRadius: 8, marginBottom: 8 }}
          />
          <div
            className="animate-pulse"
            style={{ width: 150, height: 14, backgroundColor: 'var(--color-surface-3)', borderRadius: 6 }}
          />
        </div>
        <div
          className="animate-pulse flex-shrink-0"
          style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--color-surface-3)' }}
        />
      </div>

      {/* Widget skeletons (workout, nutrition, check-in) */}
      {[80, 80, 100].map((h, i) => (
        <div key={i} style={{ padding: '0 16px 16px' }}>
          <div
            className="animate-pulse"
            style={{
              height: h,
              backgroundColor: 'var(--color-surface-2)',
              borderRadius: 14,
              border: '1px solid var(--color-border)',
            }}
          />
        </div>
      ))}

      {/* Stats 2×2 grid */}
      <section style={{ padding: '0 16px 16px' }}>
        <div
          className="animate-pulse"
          style={{ width: 80, height: 12, backgroundColor: 'var(--color-surface-3)', borderRadius: 4, marginBottom: 10 }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                height: 70,
                backgroundColor: 'var(--color-surface-2)',
                borderRadius: 12,
                border: '1px solid var(--color-border)',
              }}
            />
          ))}
        </div>
      </section>

      {/* Recent workouts horizontal scroll */}
      <section style={{ padding: '0 0 16px' }}>
        <div
          className="animate-pulse"
          style={{ width: 120, height: 12, backgroundColor: 'var(--color-surface-3)', borderRadius: 4, marginBottom: 10, marginLeft: 16 }}
        />
        <div className="flex gap-3" style={{ paddingLeft: 16, paddingRight: 16, overflow: 'hidden' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse flex-shrink-0"
              style={{
                width: 180,
                height: 90,
                backgroundColor: 'var(--color-surface-2)',
                borderRadius: 12,
                border: '1px solid var(--color-border)',
              }}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
