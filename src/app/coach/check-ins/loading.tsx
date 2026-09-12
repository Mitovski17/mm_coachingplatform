export default function Loading() {
  return (
    <div className="coach-page">
      {/* Page title */}
      <div
        className="cx-skel"
        style={{ width: 160, height: 28, backgroundColor: 'var(--color-surface-2)', borderRadius: 8, marginBottom: 24 }}
      />

      {/* Section label */}
      <div
        className="cx-skel"
        style={{ width: 100, height: 12, backgroundColor: 'var(--color-surface-2)', borderRadius: 4, marginBottom: 12 }}
      />

      {/* Card list */}
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="cx-skel rounded-xl"
            style={{ height: 110, backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
          />
        ))}
      </div>
    </div>
  )
}
