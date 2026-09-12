export default function Loading() {
  return (
    <div className="coach-page">
      <div
        className="cx-skel"
        style={{
          width: 100,
          height: 16,
          backgroundColor: 'var(--color-surface-2)',
          borderRadius: 6,
          marginBottom: 24,
        }}
      />

      {/* Header skeleton */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="cx-skel rounded-full"
          style={{ width: 56, height: 56, backgroundColor: 'var(--color-surface-2)' }}
        />
        <div className="flex flex-col gap-2">
          <div
            className="cx-skel"
            style={{ width: 200, height: 22, backgroundColor: 'var(--color-surface-2)', borderRadius: 6 }}
          />
          <div
            className="cx-skel"
            style={{ width: 140, height: 14, backgroundColor: 'var(--color-surface-2)', borderRadius: 6 }}
          />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div
        className="cx-skel rounded-md mb-6"
        style={{ height: 40, backgroundColor: 'var(--color-surface-2)' }}
      />

      {/* 2x2 grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="cx-skel rounded-xl"
            style={{
              height: 100,
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
