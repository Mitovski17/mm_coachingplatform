export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px' }}>
      <div className="animate-pulse" style={{ width: 140, height: 24, backgroundColor: 'var(--color-surface-3)', borderRadius: 8, marginBottom: 24 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[240, 80, 180].map((h, i) => (
          <div key={i} className="animate-pulse" style={{ height: h, backgroundColor: 'var(--color-surface-2)', borderRadius: 12, border: '1px solid var(--color-border)' }} />
        ))}
      </div>
      <div className="animate-pulse" style={{ height: 52, backgroundColor: 'var(--color-surface-2)', borderRadius: 12, border: '1px solid var(--color-border)', marginTop: 16 }} />
    </div>
  )
}
