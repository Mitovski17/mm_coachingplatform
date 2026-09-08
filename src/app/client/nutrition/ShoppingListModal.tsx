'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  X,
  Check,
  Minus,
  Plus,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ShoppingBasket,
  EyeOff,
} from 'lucide-react'
import { buildShoppingList } from './actions'
import { useLanguage, tx } from '@/lib/i18n'
import {
  CATEGORY_ORDER,
  formatAmount,
  type ShoppingCategory,
  type ShoppingItem,
  type ShoppingList,
} from '@/lib/shopping-list'

const PRESET_DAYS = [3, 7, 10] as const
const MIN_DAYS = 1
const MAX_DAYS = 60

type Step = 'range' | 'list' | 'exclude'
type Selection = (typeof PRESET_DAYS)[number] | 'custom'

// ── Persistence ─────────────────────────────────────────────────────────────
// Exclusions ("I always have olive oil") are a standing preference, so they
// outlive any one list. Ticks are tied to the list in hand and reset whenever a
// different period is generated — but survive backgrounding the app mid-aisle.

type CheckedState = { sig: string; keys: Record<string, true> }

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked or full — the in-memory state still carries this session.
  }
}

export default function ShoppingListModal({
  open,
  onClose,
  clientId,
  startDate,
}: {
  open: boolean
  onClose: () => void
  clientId: string | null
  startDate: string
}) {
  const { t, lang } = useLanguage()
  const copy = t.nutrition.shopping

  const [step, setStep] = useState<Step>('range')
  const [selection, setSelection] = useState<Selection>(7)
  const [customDays, setCustomDays] = useState('14')
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [result, setResult] = useState<ShoppingList | null>(null)
  const [checked, setChecked] = useState<Record<string, true>>({})
  // Nothing renders until the sheet is opened, so reading storage up front is
  // safe here — there is no server/client output to disagree about.
  const [excluded, setExcluded] = useState<Record<string, true>>(() =>
    clientId ? readJson<Record<string, true>>(`nutriShopExcluded_${clientId}`, {}) : {}
  )

  const days = selection === 'custom' ? clampDays(customDays) : selection
  const listSig = result ? `${result.startDate}|${result.days}` : ''

  // Closing decides where the next open lands: back on the list when there is
  // one to come back to, otherwise the period picker.
  const close = useCallback(() => {
    setStep(result ? 'list' : 'range')
    setFailed(false)
    onClose()
  }, [result, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const persistExcluded = useCallback(
    (next: Record<string, true>) => {
      setExcluded(next)
      if (clientId) writeJson(`nutriShopExcluded_${clientId}`, next)
    },
    [clientId]
  )

  const persistChecked = useCallback(
    (next: Record<string, true>) => {
      setChecked(next)
      if (clientId) writeJson(`nutriShopChecked_${clientId}`, { sig: listSig, keys: next })
    },
    [clientId, listSig]
  )

  const generate = useCallback(
    async (thenExclude: boolean) => {
      if (loading) return
      setLoading(true)
      setFailed(false)
      try {
        const list = await buildShoppingList(startDate, days)
        setResult(list)
        // Ticks belong to a specific list. Regenerating the same period after
        // coming back to the app restores them; a different period starts clean.
        const sig = `${list.startDate}|${list.days}`
        const saved = clientId
          ? readJson<CheckedState | null>(`nutriShopChecked_${clientId}`, null)
          : null
        setChecked(saved && saved.sig === sig ? (saved.keys ?? {}) : {})
        setStep(thenExclude && list.items.length > 0 ? 'exclude' : 'list')
      } catch {
        setFailed(true)
      } finally {
        setLoading(false)
      }
    },
    [clientId, days, loading, startDate]
  )

  const items = useMemo(() => result?.items ?? [], [result])
  const visible = useMemo(() => items.filter((i) => !excluded[i.key]), [items, excluded])
  const hidden = useMemo(() => items.filter((i) => excluded[i.key]), [items, excluded])
  const packedCount = visible.filter((i) => checked[i.key]).length

  // The coach's wording is what's stored; the dictionary gives it in the
  // client's language, and the list sorts on what they actually read.
  const foodDict = t.foods as Record<string, string>
  const label = useCallback(
    (item: ShoppingItem) => tx(foodDict, item.foodName),
    [foodDict]
  )

  const groups = useMemo(() => {
    const byCategory = new Map<ShoppingCategory, ShoppingItem[]>()
    for (const item of visible) {
      const bucket = byCategory.get(item.category)
      if (bucket) bucket.push(item)
      else byCategory.set(item.category, [item])
    }
    return CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => ({
      category,
      items: byCategory
        .get(category)!
        .slice()
        .sort((a, b) => label(a).localeCompare(label(b), lang === 'bg' ? 'bg' : 'en')),
    }))
  }, [visible, lang, label])

  if (!open) return null

  const headerTitle = step === 'exclude' ? copy.excludeTitle : copy.title
  const headerSub =
    step === 'exclude'
      ? copy.excludeSubtitle
      : step === 'list' && result
        ? `${copy.daysLabel(result.days)} · ${formatRange(result.startDate, result.endDate, lang)}`
        : copy.subtitle

  return (
    <div
      onClick={close}
      className="cx-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cx-sheet"
        style={{
          backgroundColor: 'var(--color-surface-1)',
          borderRadius: '28px 28px 0 0',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--cx-shadow-lg)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14, paddingBottom: 6, flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: 'var(--color-surface-3)' }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '8px 20px 14px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          {step === 'exclude' && (
            <button
              type="button"
              onClick={() => setStep('list')}
              aria-label={t.common.back}
              className="cx-press"
              style={{ ...roundButton, marginTop: 2 }}
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              className="cx-display"
              style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}
            >
              {headerTitle}
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '3px 0 0', lineHeight: 1.45 }}>
              {headerSub}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t.common.close}
            className="cx-press"
            style={{ ...roundButton, marginTop: 2 }}
          >
            <X size={17} />
          </button>
        </div>

        {/* ── Period picker ─────────────────────────────────────────────── */}
        {step === 'range' && (
          <div style={{ overflowY: 'auto', overscrollBehavior: 'contain', padding: '18px 20px 24px' }}>
            <p style={sectionLabel}>{copy.rangeQuestion}</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {PRESET_DAYS.map((n) => {
                const active = selection === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelection(n)}
                    aria-pressed={active}
                    className="cx-press"
                    style={{
                      ...choiceCard,
                      padding: '16px 8px 14px',
                      borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                      backgroundColor: active ? 'var(--color-accent-dim)' : 'var(--color-surface-2)',
                    }}
                  >
                    <span
                      className="cx-num"
                      style={{
                        fontSize: 26,
                        fontWeight: 800,
                        lineHeight: 1,
                        color: active ? 'var(--color-accent)' : 'var(--color-text-primary)',
                      }}
                    >
                      {n}
                    </span>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      }}
                    >
                      {copy.daysUnit}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Custom period */}
            <button
              type="button"
              onClick={() => setSelection('custom')}
              aria-pressed={selection === 'custom'}
              className="cx-press"
              style={{
                ...choiceCard,
                flexDirection: 'row',
                justifyContent: 'space-between',
                width: '100%',
                marginTop: 10,
                padding: '13px 16px',
                borderColor: selection === 'custom' ? 'var(--color-accent)' : 'var(--color-border)',
                backgroundColor: selection === 'custom' ? 'var(--color-accent-dim)' : 'var(--color-surface-2)',
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: selection === 'custom' ? 'var(--color-accent)' : 'var(--color-text-primary)',
                }}
              >
                {copy.custom}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--color-text-hint)' }}>{copy.customHint}</span>
            </button>

            {selection === 'custom' && (
              <div className="cx-pop" style={{ marginTop: 10 }}>
                <label
                  htmlFor="shopping-custom-days"
                  style={{ ...sectionLabel, display: 'block', marginBottom: 8 }}
                >
                  {copy.customLabel}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setCustomDays(String(clampDays(customDays) - 1))}
                    disabled={clampDays(customDays) <= MIN_DAYS}
                    aria-label={`−1 ${copy.customLabel}`}
                    className="cx-press"
                    style={{ ...stepperButton, opacity: clampDays(customDays) <= MIN_DAYS ? 0.4 : 1 }}
                  >
                    <Minus size={17} />
                  </button>
                  <input
                    id="shopping-custom-days"
                    type="text"
                    inputMode="numeric"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                    onBlur={() => setCustomDays(String(clampDays(customDays)))}
                    className="cx-num"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 46,
                      textAlign: 'center',
                      fontSize: 18,
                      fontWeight: 800,
                      color: 'var(--color-text-primary)',
                      backgroundColor: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--cx-r-sm)',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setCustomDays(String(clampDays(customDays) + 1))}
                    disabled={clampDays(customDays) >= MAX_DAYS}
                    aria-label={`+1 ${copy.customLabel}`}
                    className="cx-press"
                    style={{ ...stepperButton, opacity: clampDays(customDays) >= MAX_DAYS ? 0.4 : 1 }}
                  >
                    <Plus size={17} />
                  </button>
                </div>
              </div>
            )}

            {failed && (
              <div
                role="status"
                className="flex items-center gap-2"
                style={{
                  marginTop: 14,
                  backgroundColor: 'rgba(239,68,68,0.10)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  borderRadius: 12,
                  padding: '9px 12px',
                }}
              >
                <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{copy.failed}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => void generate(false)}
              disabled={loading}
              className="cx-cta"
              style={{
                width: '100%',
                marginTop: 18,
                height: 52,
                borderRadius: 'var(--cx-r-md)',
                border: 'none',
                backgroundColor: 'var(--color-accent)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 800,
                cursor: loading ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <ShoppingBasket size={17} />}
              {loading ? copy.generating : copy.generate}
            </button>

            {/* Optional, quieter sibling of the CTA — the bulk-buy escape hatch. */}
            <button
              type="button"
              onClick={() => void generate(true)}
              disabled={loading}
              className="cx-press cx-tint"
              style={secondaryButton}
            >
              <EyeOff size={13} />
              {copy.excludeCta}
            </button>

            <p style={{ ...footnote, textAlign: 'center', marginTop: 12 }}>{copy.planNote}</p>
          </div>
        )}

        {/* ── The list ──────────────────────────────────────────────────── */}
        {step === 'list' && result && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '14px 20px 8px' }}>
              {items.length === 0 ? (
                <EmptyState title={copy.empty} sub={copy.emptySub} />
              ) : visible.length === 0 ? (
                <EmptyState title={copy.allExcluded} sub={copy.allExcludedSub} />
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      {copy.packed(packedCount, visible.length)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep('range')}
                      className="cx-press-sm cx-hit"
                      style={{
                        position: 'relative',
                        border: 'none',
                        background: 'transparent',
                        padding: '6px 0',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--color-accent)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {copy.changePeriod}
                    </button>
                  </div>

                  <div
                    aria-hidden="true"
                    style={{
                      height: 4,
                      borderRadius: 999,
                      backgroundColor: 'var(--color-surface-2)',
                      overflow: 'hidden',
                      marginBottom: 18,
                    }}
                  >
                    <div
                      className="cx-bar-fill"
                      style={
                        {
                          '--cx-p': visible.length ? packedCount / visible.length : 0,
                          height: '100%',
                          backgroundColor: 'var(--color-accent)',
                        } as React.CSSProperties
                      }
                    />
                  </div>

                  {groups.map(({ category, items: groupItems }) => (
                    <div key={category} style={{ marginBottom: 18 }}>
                      <p style={{ ...sectionLabel, marginBottom: 6 }}>{copy.categories[category]}</p>
                      <div
                        style={{
                          backgroundColor: 'var(--color-surface-2)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--cx-r-md)',
                          overflow: 'hidden',
                        }}
                      >
                        {groupItems.map((item, i) => {
                          const isChecked = !!checked[item.key]
                          return (
                            <button
                              key={item.key}
                              type="button"
                              aria-pressed={isChecked}
                              onClick={() => {
                                const next = { ...checked }
                                if (isChecked) delete next[item.key]
                                else next[item.key] = true
                                persistChecked(next)
                              }}
                              className="cx-press-sm cx-tint"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                width: '100%',
                                minHeight: 48,
                                padding: '10px 14px',
                                border: 'none',
                                borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                                background: 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <Tickbox on={isChecked} />
                              <span
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  fontSize: 14,
                                  fontWeight: 600,
                                  color: isChecked ? 'var(--color-text-hint)' : 'var(--color-text-primary)',
                                  textDecoration: isChecked ? 'line-through' : 'none',
                                }}
                              >
                                {label(item)}
                              </span>
                              <span
                                className="cx-num"
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  flexShrink: 0,
                                  color: isChecked ? 'var(--color-text-hint)' : 'var(--color-text-muted)',
                                }}
                              >
                                {formatAmount(item.quantity, item.unit)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {hidden.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ ...sectionLabel, marginBottom: 6 }}>{copy.excludedSection(hidden.length)}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {hidden.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          const next = { ...excluded }
                          delete next[item.key]
                          persistExcluded(next)
                        }}
                        className="cx-press-sm cx-tint"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          minHeight: 34,
                          padding: '6px 12px',
                          borderRadius: 999,
                          border: '1px dashed var(--color-border-strong)',
                          background: 'transparent',
                          color: 'var(--color-text-hint)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={12} />
                        {label(item)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div
                style={{
                  flexShrink: 0,
                  padding: '12px 20px 24px',
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setStep('exclude')}
                  className="cx-press cx-tint"
                  style={{ ...secondaryButton, marginTop: 0 }}
                >
                  <EyeOff size={13} />
                  {copy.excludeCta}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Exclusions ────────────────────────────────────────────────── */}
        {step === 'exclude' && result && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '14px 20px 8px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...excluded }
                    for (const item of items) if (item.staple) next[item.key] = true
                    persistExcluded(next)
                  }}
                  className="cx-press-sm cx-tint"
                  style={quickChip}
                >
                  {copy.selectStaples}
                </button>
                <button
                  type="button"
                  onClick={() => persistExcluded({})}
                  className="cx-press-sm cx-tint"
                  style={quickChip}
                >
                  {copy.clearExcluded}
                </button>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--cx-r-md)',
                  overflow: 'hidden',
                }}
              >
                {items.map((item, i) => {
                  const isExcluded = !!excluded[item.key]
                  return (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={isExcluded}
                      onClick={() => {
                        const next = { ...excluded }
                        if (isExcluded) delete next[item.key]
                        else next[item.key] = true
                        persistExcluded(next)
                      }}
                      className="cx-press-sm cx-tint"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        width: '100%',
                        minHeight: 48,
                        padding: '10px 14px',
                        border: 'none',
                        borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <Tickbox on={isExcluded} />
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 14,
                          fontWeight: 600,
                          color: isExcluded ? 'var(--color-text-hint)' : 'var(--color-text-primary)',
                          textDecoration: isExcluded ? 'line-through' : 'none',
                        }}
                      >
                        {label(item)}
                      </span>
                      {item.staple && !isExcluded && (
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: 'var(--color-text-hint)',
                            border: '1px solid var(--color-border-strong)',
                            borderRadius: 999,
                            padding: '2px 7px',
                          }}
                        >
                          {copy.stapleBadge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ flexShrink: 0, padding: '12px 20px 24px', borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                onClick={() => setStep('list')}
                className="cx-cta"
                style={{
                  width: '100%',
                  height: 50,
                  borderRadius: 'var(--cx-r-md)',
                  border: 'none',
                  backgroundColor: 'var(--color-accent)',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {copy.done}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Tickbox({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        borderRadius: 7,
        border: on ? '1px solid var(--color-accent)' : '1.5px solid var(--color-border-strong)',
        backgroundColor: on ? 'var(--color-accent)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color var(--cx-dur) var(--cx-ease), border-color var(--cx-dur) var(--cx-ease)',
      }}
    >
      {on && <Check size={14} strokeWidth={3} color="#fff" />}
    </span>
  )
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div
      style={{
        border: '1px dashed var(--color-border-strong)',
        borderRadius: 'var(--cx-r-lg)',
        padding: '28px 16px',
        textAlign: 'center',
        marginBottom: 16,
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>{title}</p>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>{sub}</p>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function clampDays(raw: string | number): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n) || n < MIN_DAYS) return MIN_DAYS
  return Math.min(n, MAX_DAYS)
}

function formatRange(startISO: string, endISO: string, lang: string): string {
  const locale = lang === 'bg' ? 'bg-BG' : 'en-GB'
  const start = new Date(startISO + 'T00:00:00')
  const end = new Date(endISO + 'T00:00:00')
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const from = start.toLocaleDateString(locale, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  const to = end.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  return `${from} – ${to}`
}

// ── Shared style fragments ──────────────────────────────────────────────────

const roundButton: React.CSSProperties = {
  width: 34,
  height: 34,
  flexShrink: 0,
  borderRadius: '50%',
  backgroundColor: 'var(--color-surface-3)',
  border: 'none',
  color: 'var(--color-text-hint)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--color-text-hint)',
  margin: '0 0 10px',
}

const choiceCard: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  borderRadius: 'var(--cx-r-md)',
  borderWidth: 1.5,
  borderStyle: 'solid',
  cursor: 'pointer',
}

const stepperButton: React.CSSProperties = {
  width: 46,
  height: 46,
  flexShrink: 0,
  borderRadius: 'var(--cx-r-sm)',
  backgroundColor: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

/**
 * Deliberately quieter than the accent CTA it sits under: smaller type, no fill
 * and a dashed edge — the app's existing vocabulary for "optional extra".
 */
const secondaryButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  width: '100%',
  marginTop: 10,
  minHeight: 44,
  padding: '11px 14px',
  borderRadius: 'var(--cx-r-sm)',
  border: '1px dashed var(--color-border-strong)',
  backgroundColor: 'transparent',
  color: 'var(--color-text-muted)',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
}

const quickChip: React.CSSProperties = {
  minHeight: 36,
  padding: '8px 14px',
  borderRadius: 999,
  border: '1px solid var(--color-border-strong)',
  backgroundColor: 'transparent',
  color: 'var(--color-text-muted)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const footnote: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--color-text-hint)',
  margin: 0,
  lineHeight: 1.5,
}
