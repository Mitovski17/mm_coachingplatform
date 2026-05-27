export default function Loading() {
  return (
    <div className="coach-page">
      {/* Page title */}
      <div
        className="animate-pulse"
        style={{ width: 180, height: 28, backgroundColor: '#1A1A1A', borderRadius: 8, marginBottom: 24 }}
      />

      {/* Table header */}
      <div
        className="animate-pulse rounded-xl"
        style={{ height: 44, backgroundColor: '#1A1A1A', marginBottom: 2 }}
      />

      {/* Table rows */}
      <div className="flex flex-col gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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
