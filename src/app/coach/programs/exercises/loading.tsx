export default function Loading() {
  return (
    <div className="coach-page">
      {/* Title */}
      <div className="animate-pulse" style={{ width: 200, height: 28, backgroundColor: '#1A1A1A', borderRadius: 8, marginBottom: 20 }} />

      {/* Search bar */}
      <div className="animate-pulse" style={{ height: 40, backgroundColor: '#1A1A1A', borderRadius: 8, marginBottom: 16 }} />

      {/* Exercise rows */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl"
            style={{ height: 52, backgroundColor: '#1A1A1A', border: '1px solid var(--color-border)' }}
          />
        ))}
      </div>
    </div>
  )
}
