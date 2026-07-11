'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Zap, ZapOff, PlusCircle } from 'lucide-react'
import { lookupBarcode, logCustomFood, addBarcodeFood } from './actions'
import type { FoodSearchResult } from '@/lib/food-search'
import { useLanguage } from '@/lib/i18n'

type Phase = 'scanning' | 'loading' | 'found' | 'not-found' | 'manual'

type Props = {
  clientId: string
  workspaceId: string
  mealName: string
  logDate: string
  onClose: () => void
  onLogged: () => void
}

// Barcodes are wide and short — restrict to 1D retail formats so the decoder
// spends its budget on the right symbologies instead of QR/data-matrix.
const BARCODE_FORMATS = [2, 3, 5, 8, 9, 10, 14, 15, 16] // CODABAR, CODE_39, CODE_128, ITF, EAN_13, EAN_8, UPC_A, UPC_E, UPC_EAN_EXTENSION

export default function BarcodeScannerModal({
  clientId,
  workspaceId,
  mealName,
  logDate,
  onClose,
  onLogged,
}: Props) {
  const { t } = useLanguage()
  const [phase, setPhase] = useState<Phase>('scanning')
  const [result, setResult] = useState<FoodSearchResult | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [logging, setLogging] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)

  const mountedRef = useRef(true)
  const stoppedRef = useRef(false)
  const scannerRef = useRef<{
    stop: () => Promise<void>
    clear: () => void
    applyVideoConstraints: (c: MediaTrackConstraints) => Promise<void>
    getRunningTrackCapabilities: () => MediaTrackCapabilities
  } | null>(null)

  useEffect(() => {
    mountedRef.current = true
    stoppedRef.current = false

    const startScanner = async () => {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!mountedRef.current) return

      const scanner = new Html5Qrcode('barcode-reader-container', {
        verbose: false,
        formatsToSupport: BARCODE_FORMATS,
        // Use the browser's native BarcodeDetector when available — it is far
        // more reliable on small / low-contrast barcodes than the JS fallback.
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      } as never)
      scannerRef.current = scanner as never

      // Request the highest practical resolution and continuous autofocus so
      // tiny barcodes stay sharp. focusMode/advanced aren't in the TS lib types
      // but browsers honour them, so we cast through.
      const videoConstraints = {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        advanced: [{ focusMode: 'continuous' }],
      } as unknown as MediaTrackConstraints

      // Rectangular scan box that tracks the viewport width — barcodes fill the
      // frame horizontally, so a wide box locks on faster than a square one.
      const qrboxFn = (vw: number, vh: number) => {
        const width = Math.floor(Math.min(vw, 400) * 0.85)
        const height = Math.floor(Math.min(width * 0.55, vh * 0.6))
        return { width, height }
      }

      await scanner.start(
        videoConstraints,
        {
          fps: 15,
          qrbox: qrboxFn,
          aspectRatio: 1.7778,
          disableFlip: true,
        },
        async (decodedText: string) => {
          if (!mountedRef.current || stoppedRef.current) return
          stoppedRef.current = true

          try {
            await scanner.stop()
          } catch {
            // ignore stop errors
          }

          if (!mountedRef.current) return
          setScannedBarcode(decodedText)
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

      // Nudge continuous focus on again after the stream is live (some devices
      // reset focusMode once the track starts) and detect torch support.
      try {
        await scanner.applyVideoConstraints({
          advanced: [{ focusMode: 'continuous' }],
        } as unknown as MediaTrackConstraints)
      } catch {
        // device may not support programmatic focus control
      }
      try {
        const caps = scanner.getRunningTrackCapabilities() as MediaTrackCapabilities & { torch?: boolean }
        if (mountedRef.current && caps?.torch) setTorchAvailable(true)
      } catch {
        // capabilities unavailable
      }
    }

    startScanner().catch((err) => {
      console.error('Barcode scanner failed to start:', err)
      if (mountedRef.current) {
        setScanError(t.nutrition.cameraPermission)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleTorch = async () => {
    const s = scannerRef.current
    if (!s) return
    const next = !torchOn
    try {
      await s.applyVideoConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints)
      setTorchOn(next)
    } catch {
      // torch toggle failed — leave state unchanged
    }
  }

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
            {phase === 'manual' ? t.nutrition.addProductTitle : 'Scan Barcode'}
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
          {t.nutrition.pointAtBarcode}
        </p>
        <div
          id="barcode-reader-container"
          style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: 16,
            overflow: 'hidden',
          }}
        />
        {torchAvailable && (
          <button
            type="button"
            onClick={toggleTorch}
            style={{
              marginTop: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: torchOn ? '#f97316' : 'rgba(255,255,255,0.12)',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {torchOn ? <ZapOff size={16} /> : <Zap size={16} />}
            {t.nutrition.torch}
          </button>
        )}
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
            {t.common.close}
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
            {t.nutrition.scanning}
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
                { label: t.nutrition.kcal, value: Math.round(result.caloriesPer100g), color: '#fff' },
                { label: t.nutrition.protein, value: `${Math.round(result.proteinPer100g)}g`, color: '#3b82f6' },
                { label: t.nutrition.carbs, value: `${Math.round(result.carbsPer100g)}g`, color: '#f97316' },
                { label: t.nutrition.fat, value: `${Math.round(result.fatPer100g)}g`, color: '#ef4444' },
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
              {t.nutrition.per100g}
            </p>

            {/* Quantity input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600, flexShrink: 0 }}>
                {t.nutrition.quantity}
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
              {logging ? t.common.sending : t.nutrition.addToMeal}
            </button>
          </div>
        </div>
      )}

      {/* Not found state — offer to contribute the product */}
      {phase === 'not-found' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            padding: '0 32px',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px', lineHeight: 1.3 }}>
              {t.nutrition.barcodeNotInDb}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>
              {t.nutrition.barcodeNotInDbSub}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPhase('manual')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              backgroundColor: '#f97316',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '14px 28px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <PlusCircle size={18} />
            {t.nutrition.addProductManually}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              color: 'rgba(255,255,255,0.5)',
              background: 'transparent',
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t.common.close}
          </button>
        </div>
      )}

      {/* Manual product entry */}
      {phase === 'manual' && (
        <ManualProductForm
          clientId={clientId}
          workspaceId={workspaceId}
          mealName={mealName}
          logDate={logDate}
          barcode={scannedBarcode ?? ''}
          onCancel={() => setPhase('not-found')}
          onSaved={() => {
            onLogged()
            onClose()
          }}
        />
      )}
    </div>
  )
}

// ─── Manual product entry form ────────────────────────────────────────────────

function ManualProductForm({
  clientId,
  workspaceId,
  mealName,
  logDate,
  barcode,
  onCancel,
  onSaved,
}: {
  clientId: string
  workspaceId: string
  mealName: string
  logDate: string
  barcode: string
  onCancel: () => void
  onSaved: () => void
}) {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')
  const [amount, setAmount] = useState('100')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const num = (v: string) => {
    const n = parseFloat(v)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }

  const handleSave = async () => {
    setError(null)
    if (!name.trim()) {
      setError(t.nutrition.productNameRequired)
      return
    }
    if (!calories.trim() || num(calories) <= 0) {
      setError(t.nutrition.caloriesRequired)
      return
    }
    const qty = num(amount)
    if (qty <= 0) {
      setError(t.nutrition.caloriesRequired)
      return
    }
    setSaving(true)
    try {
      await addBarcodeFood({
        clientId,
        workspaceId,
        loggedDate: logDate,
        mealType: mealName,
        barcode: barcode || `manual_${Date.now()}`,
        name: name.trim(),
        brand: brand.trim() || null,
        caloriesPer100g: num(calories),
        proteinPer100g: num(protein),
        carbsPer100g: num(carbs),
        fatPer100g: num(fat),
        fiberPer100g: fiber.trim() ? num(fiber) : null,
        quantity: qty,
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    fontSize: 15,
    fontWeight: 600,
    backgroundColor: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 12,
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 6,
    display: 'block',
    letterSpacing: '0.02em',
  }

  const macroField = (
    label: string,
    value: string,
    setter: (v: string) => void,
    color: string,
    suffix = 'g'
  ) => (
    <div>
      <label style={{ ...labelStyle, color }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => setter(e.target.value)}
          min="0"
          placeholder="0"
          style={inputStyle}
        />
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>
          {suffix}
        </span>
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, padding: '4px 20px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>{t.nutrition.productName}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.nutrition.productName}
          autoFocus
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>{t.nutrition.productBrand}</label>
        <input
          type="text"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder={t.nutrition.productBrand}
          style={inputStyle}
        />
      </div>

      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '4px 0 -4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
        {t.nutrition.per100gValues}
      </p>

      <div>
        <label style={labelStyle}>{t.nutrition.caloriesLabel}</label>
        <div style={{ position: 'relative' }}>
          <input
            type="number"
            inputMode="decimal"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            min="0"
            placeholder="0"
            style={inputStyle}
          />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>
            {t.nutrition.kcal}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {macroField(t.nutrition.protein, protein, setProtein, '#3b82f6')}
        {macroField(t.nutrition.carbs, carbs, setCarbs, '#f97316')}
        {macroField(t.nutrition.fat, fat, setFat, '#ef4444')}
        {macroField(t.nutrition.fiber, fiber, setFiber, '#10b981')}
      </div>

      <div>
        <label style={labelStyle}>{t.nutrition.quantityEatenG}</label>
        <div style={{ position: 'relative' }}>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            style={inputStyle}
          />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>
            g
          </span>
        </div>
      </div>

      {error && (
        <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 600, margin: 0, textAlign: 'center' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%',
          backgroundColor: '#f97316',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          padding: '15px 0',
          fontSize: 15,
          fontWeight: 700,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
          marginTop: 4,
        }}
      >
        {saving ? t.common.sending : t.nutrition.saveAndLog}
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.45)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {t.common.cancel}
      </button>
    </div>
  )
}
