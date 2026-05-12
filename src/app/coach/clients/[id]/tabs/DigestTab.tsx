'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import type { AiDigest } from '../actions'

const cardBase: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-1)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  padding: 16,
}

const RAG_CONFIG = {
  green: {
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.3)',
    color: '#22c55e',
    label: 'On Track',
  },
  yellow: {
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.3)',
    color: '#f59e0b',
    label: 'Needs Attention',
  },
  red: {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.3)',
    color: '#ef4444',
    label: 'At Risk',
  },
}

function mapResponseToDigest(row: Record<string, unknown>): AiDigest {
  return {
    id: row.id as string,
    weekStartDate: row.week_start_date as string,
    summary: row.summary as string,
    wins: (row.wins as string[]) ?? [],
    concerns: (row.concerns as string[]) ?? [],
    actions: (row.actions as string[]) ?? [],
    suggestedResponse: row.suggested_response as string,
    ragStatus: row.rag_status as 'red' | 'yellow' | 'green',
    createdAt: row.created_at as string,
  }
}

export default function DigestTab({
  clientId,
  initialDigest,
}: {
  clientId: string
  initialDigest: AiDigest | null
}) {
  const [digest, setDigest] = useState<AiDigest | null>(initialDigest)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/digest/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const saved = (await res.json()) as Record<string, unknown>
      setDigest(mapResponseToDigest(saved))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate digest')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    if (!digest?.suggestedResponse) return
    await navigator.clipboard.writeText(digest.suggestedResponse)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const rag = digest ? RAG_CONFIG[digest.ragStatus] : null

  return (
    <div className="flex flex-col gap-4">
      {/* Header row: badge + generate button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            style={{
              color: 'var(--color-text-primary)',
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            Weekly Digest
          </div>
          {rag && (
            <span
              className="inline-flex items-center px-3 py-1 text-xs"
              style={{
                backgroundColor: rag.bg,
                color: rag.color,
                border: `1px solid ${rag.border}`,
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
              }}
            >
              ● {rag.label}
            </span>
          )}
          {digest && (
            <span
              className="text-xs"
              style={{ color: 'var(--color-text-hint)' }}
            >
              Week of {format(new Date(digest.weekStartDate), 'MMM d, yyyy')}
            </span>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm transition-colors"
          style={{
            backgroundColor: generating
              ? 'var(--color-surface-3)'
              : 'var(--color-accent)',
            color: generating ? 'var(--color-text-hint)' : '#fff',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            cursor: generating ? 'not-allowed' : 'pointer',
            border: 'none',
          }}
        >
          {generating ? (
            <>
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  border: '2px solid var(--color-text-hint)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              Generating…
            </>
          ) : (
            digest ? 'Regenerate' : 'Generate digest'
          )}
        </button>
      </div>

      {error && (
        <div
          className="text-sm px-3 py-2"
          style={{
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 'var(--radius-md)',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      )}

      {!digest && !generating && (
        <div
          style={{ ...cardBase, textAlign: 'center', padding: '48px 16px' }}
        >
          <div
            style={{ color: 'var(--color-text-hint)', fontSize: 14 }}
          >
            No digest generated yet. Click &ldquo;Generate digest&rdquo; to analyse this client&apos;s check-ins.
          </div>
        </div>
      )}

      {digest && (
        <>
          {/* Summary */}
          <div style={cardBase}>
            <div
              className="text-xs uppercase tracking-wide mb-2"
              style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
            >
              Summary
            </div>
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {digest.summary}
            </p>
          </div>

          {/* Wins + Concerns side by side on wider screens */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Wins */}
            <div style={cardBase}>
              <div
                className="text-xs uppercase tracking-wide mb-3"
                style={{ color: '#22c55e', fontWeight: 600 }}
              >
                Wins
              </div>
              {digest.wins.length === 0 ? (
                <div
                  className="text-sm"
                  style={{ color: 'var(--color-text-hint)' }}
                >
                  None recorded.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {digest.wins.map((w, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span style={{ color: '#22c55e', flexShrink: 0 }}>✓</span>
                      <span style={{ color: 'var(--color-text-primary)' }}>{w}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Concerns */}
            <div style={cardBase}>
              <div
                className="text-xs uppercase tracking-wide mb-3"
                style={{ color: '#f97316', fontWeight: 600 }}
              >
                Concerns
              </div>
              {digest.concerns.length === 0 ? (
                <div
                  className="text-sm"
                  style={{ color: 'var(--color-text-hint)' }}
                >
                  No concerns.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {digest.concerns.map((c, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span style={{ color: '#f97316', flexShrink: 0 }}>!</span>
                      <span style={{ color: 'var(--color-text-primary)' }}>{c}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={cardBase}>
            <div
              className="text-xs uppercase tracking-wide mb-3"
              style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
            >
              Recommended Actions
            </div>
            {digest.actions.length === 0 ? (
              <div
                className="text-sm"
                style={{ color: 'var(--color-text-hint)' }}
              >
                No actions.
              </div>
            ) : (
              <ol className="flex flex-col gap-2">
                {digest.actions.map((a, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span
                      style={{
                        color: 'var(--color-text-hint)',
                        fontWeight: 600,
                        flexShrink: 0,
                        minWidth: 18,
                      }}
                    >
                      {i + 1}.
                    </span>
                    <span style={{ color: 'var(--color-text-primary)' }}>{a}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Suggested response */}
          <div style={cardBase}>
            <div className="flex items-center justify-between mb-3">
              <div
                className="text-xs uppercase tracking-wide"
                style={{ color: 'var(--color-text-hint)', fontWeight: 500 }}
              >
                Suggested Response
              </div>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs transition-colors"
                style={{
                  backgroundColor: copied
                    ? 'rgba(34,197,94,0.12)'
                    : 'var(--color-surface-2)',
                  color: copied ? '#22c55e' : 'var(--color-text-muted)',
                  borderRadius: 'var(--radius-sm)',
                  border: copied
                    ? '1px solid rgba(34,197,94,0.3)'
                    : '1px solid var(--color-border)',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{
                color: 'var(--color-text-secondary)',
                backgroundColor: 'var(--color-surface-2)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                padding: 12,
                fontFamily: 'inherit',
              }}
            >
              {digest.suggestedResponse}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
