export default function Loading() {
  return (
    <div style={{ padding: '32px 24px' }}>
      <div className="animate-pulse" style={{ width: 160, height: 24, backgroundColor: 'var(--color-surface-3)', borderRadius: 8, marginBottom: 24 }} />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse" style={{ height: 72, backgroundColor: 'var(--color-surface-2)', borderRadius: 12, border: '1px solid var(--color-border)' }} />
        ))}
      </div>
    </div>
  )
}
