'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { lookupBarcode, logCustomFood } from './actions'
import type { FoodSearchResult } from '@/lib/food-search'

type Phase = 'scanning' | 'loading' | 'found' | 'not-found'

type Props = {
  clientId: string
  workspaceId: string
  mealName: string
  logDate: string
  onClose: () => void
  onLogged: () => void
}

export default function BarcodeScannerModal({
  clientId,
  workspaceId,
  mealName,
  logDate,
  onClose,
  onLogged,
}: Props) {
  const [phase, setPhase] = useState<Phase>('scanning')
  const [result, setResult] = useState<FoodSearchResult | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [logging, setLogging] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const stoppedRef = useRef(false)
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null)

  useEffect(() => {
    mountedRef.current = true
    stoppedRef.current = false

    const startScanner = async () => {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!mountedRef.current) return

      const scanner = new Html5Qrcode('barcode-reader-container')
      scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void }

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          if (!mountedRef.current || stoppedRef.current) return
          stoppedRef.current = true

          try {
            await scanner.stop()
          } catch {
            // ignore stop errors
          }

          if (!mountedRef.current) return
          setPhase('loading')

          const food = await lookupBarcode(decodedText)
          if (!mountedRef.current) return

          if (food) {
            setResult(food)
            setPhase('found')
          } else {
            setPhase('not-found')
          }
        },
        undefined
      )
    }

    startScanner().catch((err) => {
      console.error('Barcode scanner failed to start:', err)
      if (mountedRef.current) {
        setScanError('Could not access camera. Please allow camera permission and try again.')
      }
    })

    return () => {
      mountedRef.current = false
      const s = scannerRef.current
      if (s && !stoppedRef.current) {
        stoppedRef.current = true
        s.stop()
          .catch(() => {})
          .finally(() => {
            try { s.clear() } catch { /* ignore */ }
          })
      } else if (s) {
        try { s.clear() } catch { /* ignore */ }
      }
    }
  }, [])

  const handleConfirm = async () => {
    if (!result) return
    const q = parseFloat(quantity) || 0
    if (q <= 0) return
    setLogging(true)
    try {
      const ratio = q / 100
      await logCustomFood({
        clientId,
        workspaceId,
        loggedDate: logDate,
        mealType: mealName,
        foodName: result.brand ? `${result.name} (${result.brand})` : result.name,
        quantity: q,
        unit: 'g',
        calories: Math.round(result.caloriesPer100g * ratio * 10) / 10,
        proteinG: Math.round(result.proteinPer100g * ratio * 10) / 10,
        carbsG: Math.round(result.carbsPer100g * ratio * 10) / 10,
        fatG: Math.round(result.fatPer100g * ratio * 10) / 10,
      })
      onLogged()
      onClose()
    } finally {
      setLogging(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.95)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 20px 16px',
          flexShrink: 0,
        }}
      >
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {mealName}
          </p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '2px 0 0', lineHeight: 1.1 }}>
            Scan Barcode
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            cursor: 'pointer',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: '50%',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Scanner div — always rendered, hidden when not scanning */}
      <div
        style={{
          display: phase === 'scanning' && !scanError ? 'flex' : 'none',
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 20px 40px',
          minHeight: 300,
        }}
      >
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 20, textAlign: 'center' }}>
          Point your camera at a product barcode
        </p>
        <div
          id="barcode-reader-container"
          style={{
            width: '100%',
            maxWidth: 380,
            borderRadius: 16,
            overflow: 'hidden',
          }}
        />
      </div>

      {/* Camera error */}
      {scanError && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 32px',
            gap: 16,
          }}
        >
          <p style={{ color: '#ef4444', fontSize: 15, fontWeight: 600, textAlign: 'center', margin: 0 }}>
            {scanError}
          </p>
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '12px 28px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* Loading state */}
      {phase === 'loading' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <Loader2 size={40} className="animate-spin" style={{ color: '#fff' }} />
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: 0 }}>
            Looking up product…
          </p>
        </div>
      )}

      {/* Found state */}
      {phase === 'found' && result && (
        <div
          style={{
            flex: 1,
            padding: '8px 20px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: '20px 18px',
            }}
          >
            <p
              style={{
                fontSize: 19,
                fontWeight: 700,
                color: '#fff',
                margin: '0 0 4px',
                lineHeight: 1.2,
              }}
            >
              {result.name}
            </p>
            {result.brand && (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 14px' }}>
                {result.brand}
              </p>
            )}

            {/* Macros per 100g */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                marginBottom: 20,
              }}
            >
              {[
                { label: 'kcal', value: Math.round(result.caloriesPer100g), color: '#fff' },
                { label: 'Protein', value: `${Math.round(result.proteinPer100g)}g`, color: '#3b82f6' },
                { label: 'Carbs', value: `${Math.round(result.carbsPer100g)}g`, color: '#f97316' },
                { label: 'Fat', value: `${Math.round(result.fatPer100g)}g`, color: '#ef4444' },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    borderRadius: 10,
                    padding: '8px 6px',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: 15, fontWeight: 700, color: m.color, margin: '0 0 2px' }}>
                    {m.value}
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: 0, fontWeight: 600, letterSpacing: '0.04em' }}>
                    {m.label}
                  </p>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
              per 100g
            </p>

            {/* Quantity input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600, flexShrink: 0 }}>
                Quantity
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                style={{
                  width: 90,
                  padding: '8px 12px',
                  fontSize: 15,
                  fontWeight: 600,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 10,
                  color: '#fff',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>g</span>
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={logging || !quantity || parseFloat(quantity) <= 0}
              style={{
                width: '100%',
                backgroundColor: '#f97316',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '14px 0',
                fontSize: 15,
                fontWeight: 700,
                cursor: logging ? 'not-allowed' : 'pointer',
                opacity: logging ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {logging ? 'Adding…' : `Add to ${mealName}`}
            </button>
          </div>
        </div>
      )}

      {/* Not found state */}
      {phase === 'not-found' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            padding: '0 32px',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>
              Food not found
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              This product wasn&apos;t found in the database. Try searching by name instead.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '12px 32px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
