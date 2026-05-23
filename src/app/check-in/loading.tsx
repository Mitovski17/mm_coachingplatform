export default function Loading() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px' }}>
      <div className="animate-pulse" style={{ width: 180, height: 24, backgroundColor: 'var(--color-surface-3)', borderRadius: 8, marginBottom: 8 }} />
      <div className="animate-pulse" style={{ width: 280, height: 14, backgroundColor: 'var(--color-surface-3)', borderRadius: 6, marginBottom: 32 }} />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse" style={{ height: 72, backgroundColor: 'var(--color-surface-2)', borderRadius: 14, border: '1px solid var(--color-border)' }} />
        ))}
      </div>
    </div>
  )
}
