export default function Loading() {
  return (
    <div style={{ padding: '32px 24px' }}>
      {/* Page title */}
      <div
        className="animate-pulse"
        style={{ width: 160, height: 28, backgroundColor: '#1A1A1A', borderRadius: 8, marginBottom: 24 }}
      />

      {/* Section label */}
      <div
        className="animate-pulse"
        style={{ width: 100, height: 12, backgroundColor: '#1A1A1A', borderRadius: 4, marginBottom: 12 }}
      />

      {/* Card list */}
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl"
            style={{ height: 110, backgroundColor: '#1A1A1A', border: '1px solid var(--color-border)' }}
          />
        ))}
      </div>
    </div>
  )
}
