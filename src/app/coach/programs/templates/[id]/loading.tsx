export default function Loading() {
  return (
    <div style={{ padding: '32px 24px', maxWidth: 900 }}>
      <div className="animate-pulse" style={{ width: 100, height: 14, backgroundColor: 'var(--color-surface-3)', borderRadius: 6, marginBottom: 20 }} />
      <div className="animate-pulse" style={{ width: 260, height: 28, backgroundColor: 'var(--color-surface-3)', borderRadius: 8, marginBottom: 32 }} />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="animate-pulse" style={{ height: 80, backgroundColor: 'var(--color-surface-2)', borderRadius: 12, border: '1px solid var(--color-border)', marginBottom: 10 }} />
      ))}
    </div>
  )
}