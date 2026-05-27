export default function Loading() {
  return (
    <div className="coach-page" style={{ maxWidth: 900 }}>
      <div className="animate-pulse" style={{ width: 100, height: 14, backgroundColor: 'var(--color-surface-3)', borderRadius: 6, marginBottom: 20 }} />
      <div className="animate-pulse" style={{ width: 220, height: 28, backgroundColor: 'var(--color-surface-3)', borderRadius: 8, marginBottom: 32 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse" style={{ height: 88, backgroundColor: 'var(--color-surface-2)', borderRadius: 12, border: '1px solid var(--color-border)' }} />
        ))}
      </div>
    </div>
  )
}