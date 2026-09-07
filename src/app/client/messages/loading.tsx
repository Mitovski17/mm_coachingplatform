export default function Loading() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>
      <div className="cx-skel" style={{ width: 120, height: 22, backgroundColor: 'var(--color-surface-3)', borderRadius: 8, marginBottom: 20 }} />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="cx-skel" style={{ height: 68, backgroundColor: 'var(--color-surface-2)', borderRadius: 14, border: '1px solid var(--color-border)' }} />
        ))}
      </div>
    </div>
  )
}
