export default function Loading() {
  return (
    <div className="coach-page">
      {/* Title */}
      <div className="cx-skel" style={{ width: 200, height: 28, backgroundColor: 'var(--color-surface-2)', borderRadius: 8, marginBottom: 20 }} />

      {/* Search bar */}
      <div className="cx-skel" style={{ height: 40, backgroundColor: 'var(--color-surface-2)', borderRadius: 8, marginBottom: 16 }} />

      {/* Exercise rows */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="cx-skel rounded-xl"
            style={{ height: 52, backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
          />
        ))}
      </div>
    </div>
  )
}
