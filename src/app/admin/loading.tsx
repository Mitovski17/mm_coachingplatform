export default function Loading() {
  return (
    <div style={{ padding: '32px 24px' }}>
      <div className="animate-pulse" style={{ width: 180, height: 28, backgroundColor: 'var(--color-surface-3)', borderRadius: 8, marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 32 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse" style={{ height: 88, backgroundColor: 'var(--color-surface-2)', borderRadius: 12, border: '1px solid var(--color-border)' }} />
        ))}
      </div>
      <div className="animate-pulse" style={{ height: 320, backgroundColor: 'var(--color-surface-2)', borderRadius: 14, border: '1px solid var(--color-border)' }} />
    </div>
  )
}
