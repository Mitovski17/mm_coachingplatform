export default function Loading() {
  return (
    <div className="mx-auto" style={{ maxWidth: '480px', padding: '0 0 8px' }}>
      {/* Top card */}
      <div style={{ padding: '52px 20px 16px' }}>
        <div
          className="animate-pulse rounded-xl"
          style={{ height: 100, backgroundColor: '#1A1A1A', border: '1px solid var(--color-border)' }}
        />
      </div>

      {/* Section label */}
      <div style={{ padding: '0 20px 10px' }}>
        <div
          className="animate-pulse"
          style={{ width: 120, height: 12, backgroundColor: '#1A1A1A', borderRadius: 4 }}
        />
      </div>

      {/* List rows */}
      <div className="flex flex-col gap-3" style={{ padding: '0 16px 16px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl"
            style={{ height: 72, backgroundColor: '#1A1A1A', border: '1px solid var(--color-border)' }}
          />
        ))}
      </div>
    </div>
  )
}
