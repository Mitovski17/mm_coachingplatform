'use client'

import { useState } from 'react'
import { flagDigest, unflagDigest } from './actions'

type Digest = {
  id: string
  summary: string
  rag_status: string
  week_start_date: string
  flagged: boolean
  flag_reason: string | null
  clientName: string
  workspaceName: string
}

export default function ContentTable({ digests }: { digests: Digest[] }) {
  const [items, setItems] = useState(digests)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState<string | null>(null)

  async function handleFlag(id: string) {
    setPending(id)
    const r = reason.trim() || 'Flagged by admin'
    const result = await flagDigest(id, r)
    if (result.ok) {
      setItems((prev) => prev.map((d) => d.id === id ? { ...d, flagged: true, flag_reason: r } : d))
      setExpanded(null)
      setReason('')
    }
    setPending(null)
  }

  async function handleUnflag(id: string) {
    setPending(id)
    const result = await unflagDigest(id)
    if (result.ok) {
      setItems((prev) => prev.map((d) => d.id === id ? { ...d, flagged: false, flag_reason: null } : d))
    }
    setPending(null)
  }

  const RAG_COLORS: Record<string, string> = { green: '#10b981', amber: '#f59e0b', red: '#ef4444' }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            {['Client', 'Workspace', 'Week', 'Status', 'Summary', 'Flag', ''].map((h) => (
              <th
                key={h}
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--color-text-hint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <>
              <tr key={d.id} style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: d.flagged ? '#ef444408' : 'transparent' }}>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  {d.clientName}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {d.workspaceName}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-hint)' }}>
                  {d.week_start_date}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: RAG_COLORS[d.rag_status] ?? '#999',
                    }}
                  />
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    fontSize: 13,
                    color: 'var(--color-text-muted)',
                    maxWidth: 300,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.summary}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {d.flagged ? (
                    <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                      Flagged{d.flag_reason ? `: ${d.flag_reason}` : ''}
                    </span>
                  ) : null}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: 'pointer',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'transparent',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      View
                    </button>
                    {d.flagged ? (
                      <button
                        onClick={() => handleUnflag(d.id)}
                        disabled={pending === d.id}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: '#10b981',
                          color: '#fff',
                          opacity: pending === d.id ? 0.6 : 1,
                        }}
                      >
                        Unflag
                      </button>
                    ) : (
                      <button
                        onClick={() => setExpanded(`flag-${d.id}`)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                        }}
                      >
                        Flag
                      </button>
                    )}
                  </div>
                </td>
              </tr>

              {expanded === d.id && (
                <tr key={`exp-${d.id}`} style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                  <td colSpan={7} style={{ padding: '16px 20px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                    {d.summary}
                  </td>
                </tr>
              )}

              {expanded === `flag-${d.id}` && (
                <tr key={`flag-${d.id}`} style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                  <td colSpan={7} style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Flag reason (optional)"
                        style={{
                          flex: 1,
                          maxWidth: 360,
                          padding: '7px 12px',
                          fontSize: 13,
                          borderRadius: 8,
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-surface-1)',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                      <button
                        onClick={() => handleFlag(d.id)}
                        disabled={pending === d.id}
                        style={{
                          padding: '7px 16px',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          opacity: pending === d.id ? 0.6 : 1,
                        }}
                      >
                        Confirm Flag
                      </button>
                      <button
                        onClick={() => { setExpanded(null); setReason('') }}
                        style={{
                          padding: '7px 12px',
                          borderRadius: 8,
                          fontSize: 13,
                          cursor: 'pointer',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'transparent',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
