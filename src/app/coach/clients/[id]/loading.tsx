export default function Loading() {
  return (
    <div className="coach-page">
      <div
        className="animate-pulse"
        style={{
          width: 100,
          height: 16,
          backgroundColor: '#1A1A1A',
          borderRadius: 6,
          marginBottom: 24,
        }}
      />

      {/* Header skeleton */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="animate-pulse rounded-full"
          style={{ width: 56, height: 56, backgroundColor: '#1A1A1A' }}
        />
        <div className="flex flex-col gap-2">
          <div
            className="animate-pulse"
            style={{ width: 200, height: 22, backgroundColor: '#1A1A1A', borderRadius: 6 }}
          />
          <div
            className="animate-pulse"
            style={{ width: 140, height: 14, backgroundColor: '#1A1A1A', borderRadius: 6 }}
          />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div
        className="animate-pulse rounded-md mb-6"
        style={{ height: 40, backgroundColor: '#1A1A1A' }}
      />

      {/* 2x2 grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl"
            style={{
              height: 100,
              backgroundColor: '#1A1A1A',
              border: '1px solid var(--color-border)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
