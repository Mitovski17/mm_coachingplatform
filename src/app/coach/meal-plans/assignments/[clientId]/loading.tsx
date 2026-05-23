export default function Loading() {
  return (
    <div style={{ padding: '32px 24px' }}>
      <div className="animate-pulse" style={{ width: 100, height: 14, backgroundColor: 'var(--color-surface-3)', borderRadius: 6, marginBottom: 20 }} />
      <div className="animate-pulse" style={{ width: 200, height: 24, backgroundColor: 'var(--color-surface-3)', borderRadius: 8, marginBottom: 32 }} />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse" style={{ height: 80, backgroundColor: 'var(--color-surface-2)', borderRadius: 12, border: '1px solid var(--color-border)' }} />
        ))}
      </div>
    </div>
  )
}