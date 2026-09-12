export default function Loading() {
  return (
    <div className="coach-page">
      {/* Page title */}
      <div
        className="cx-skel"
        style={{ width: 180, height: 28, backgroundColor: 'var(--color-surface-2)', borderRadius: 8, marginBottom: 24 }}
      />

      {/* Table header */}
      <div
        className="cx-skel rounded-xl"
        style={{ height: 44, backgroundColor: 'var(--color-surface-2)', marginBottom: 2 }}
      />

      {/* Table rows */}
      <div className="flex flex-col gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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
