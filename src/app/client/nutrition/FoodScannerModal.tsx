'use client'

import { useRef, useState } from 'react'
import { X, Loader2, Camera, ImagePlus, Check } from 'lucide-react'
import { logCustomFood } from './actions'
import { useLanguage } from '@/lib/i18n'

type Phase = 'pick' | 'preview' | 'analyzing' | 'results' | 'error'

type ScannedFood = {
  name: string
  quantity: number
  unit: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

type Props = {
  clientId: string
  workspaceId: string
  mealName: string
  logDate: string
  onClose: () => void
  onLogged: () => void
}

export default function FoodScannerModal({
  clientId,
  workspaceId,
  mealName,
  logDate,
  onClose,
  onLogged,
}: Props) {
  const { t } = useLanguage()
  const [phase, setPhase] = useState<Phase>('pick')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg')
  const [foods, setFoods] = useState<ScannedFood[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [logging, setLogging] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelected = (file: File) => {
    const mime = file.type || 'image/jpeg'
    setImageMimeType(mime)
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setImageUrl(dataUrl)
      setImageBase64(dataUrl.split(',')[1])
      setPhase('preview')
    }
    reader.readAsDataURL(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelected(file)
    e.target.value = ''
  }

  const handleAnalyze = async () => {
    if (!imageBase64) return
    setPhase('analyzing')
    try {
      const res = await fetch('/api/food-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: imageMimeType }),
      })
      if (!res.ok) throw new Error('Analysis failed')
      const data = (await res.json()) as { foods: ScannedFood[] }
      const detected = data.foods ?? []
      setFoods(detected)
      setSelected(new Set(detected.map((_, i) => i)))
      setPhase('results')
    } catch {
      setErrorMsg(t.nutrition.analyzeFailed)
      setPhase('error')
    }
  }

  const toggleFood = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleLogSelected = async () => {
    if (selected.size === 0) return
    setLogging(true)
    try {
      for (const i of selected) {
        const food = foods[i]
        await logCustomFood({
          clientId,
          workspaceId,
          loggedDate: logDate,
          mealType: mealName,
          foodName: food.name,
          quantity: food.quantity,
          unit: food.unit,
          calories: Math.round(food.calories * 10) / 10,
          proteinG: Math.round(food.proteinG * 10) / 10,
          carbsG: Math.round(food.carbsG * 10) / 10,
          fatG: Math.round(food.fatG * 10) / 10,
        })
      }
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
            {t.nutrition.scanMeal}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Pick phase */}
      {phase === 'pick' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px 60px', gap: 16 }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', margin: '0 0 8px', textAlign: 'center', lineHeight: 1.5 }}>
            {t.nutrition.scanMealSub}
          </p>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            style={{ width: '100%', maxWidth: 320, backgroundColor: '#f97316', color: '#fff', border: 'none', borderRadius: 14, padding: '16px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            <Camera size={20} />
            {t.nutrition.takePhoto}
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            style={{ width: '100%', maxWidth: 320, backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 14, padding: '16px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            <ImagePlus size={20} />
            {t.nutrition.choosePhoto}
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* Preview phase */}
      {phase === 'preview' && imageUrl && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px 40px', gap: 16 }}>
          <img
            src={imageUrl}
            alt="Meal preview"
            style={{ width: '100%', maxWidth: 400, maxHeight: 320, objectFit: 'contain', borderRadius: 16 }}
          />
          <button
            type="button"
            onClick={handleAnalyze}
            style={{ width: '100%', maxWidth: 400, backgroundColor: '#f97316', color: '#fff', border: 'none', borderRadius: 14, padding: '15px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            {t.nutrition.analyzePhoto}
          </button>
          <button
            type="button"
            onClick={() => { setImageUrl(null); setImageBase64(null); setPhase('pick') }}
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            {t.common.cancel}
          </button>
        </div>
      )}

      {/* Analyzing phase */}
      {phase === 'analyzing' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Loader2 size={40} className="animate-spin" style={{ color: '#f97316' }} />
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: 0 }}>
            {t.nutrition.analyzingMeal}
          </p>
        </div>
      )}

      {/* Results phase */}
      {phase === 'results' && (
        <div style={{ flex: 1, padding: '0 20px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {foods.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '40px 0' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: 600, margin: 0, textAlign: 'center' }}>
                {t.nutrition.noFoodsDetected}
              </p>
              <button
                type="button"
                onClick={() => setPhase('pick')}
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                {t.nutrition.tryAgain}
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 2px' }}>
                {t.nutrition.detectedFoods}
              </p>
              {foods.map((food, i) => {
                const isSelected = selected.has(i)
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleFood(i)}
                    style={{
                      backgroundColor: isSelected ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isSelected ? 'rgba(249,115,22,0.45)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 14,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      textAlign: 'left',
                      width: '100%',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        backgroundColor: isSelected ? '#f97316' : 'rgba(255,255,255,0.08)',
                        border: `2px solid ${isSelected ? '#f97316' : 'rgba(255,255,255,0.25)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background-color 0.15s, border-color 0.15s',
                      }}
                    >
                      {isSelected && <Check size={13} strokeWidth={3} color="#fff" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 3px', lineHeight: 1.2 }}>
                        {food.name}
                      </p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                        {Math.round(food.quantity)}{food.unit} · {Math.round(food.calories)} kcal
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0, alignItems: 'flex-end' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>P {Math.round(food.proteinG)}g</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#f97316' }}>C {Math.round(food.carbsG)}g</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>F {Math.round(food.fatG)}g</span>
                    </div>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={handleLogSelected}
                disabled={logging || selected.size === 0}
                style={{
                  width: '100%',
                  backgroundColor: selected.size === 0 ? 'rgba(255,255,255,0.08)' : '#f97316',
                  color: selected.size === 0 ? 'rgba(255,255,255,0.25)' : '#fff',
                  border: 'none',
                  borderRadius: 14,
                  padding: '15px 0',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: selected.size === 0 || logging ? 'not-allowed' : 'pointer',
                  marginTop: 6,
                  opacity: logging ? 0.7 : 1,
                  transition: 'background-color 0.15s',
                }}
              >
                {logging ? t.common.sending : `${t.nutrition.logSelected} (${selected.size})`}
              </button>
            </>
          )}
        </div>
      )}

      {/* Error phase */}
      {phase === 'error' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 32px' }}>
          <p style={{ color: '#ef4444', fontSize: 15, fontWeight: 600, textAlign: 'center', margin: 0 }}>
            {errorMsg ?? t.nutrition.analyzeFailed}
          </p>
          <button
            type="button"
            onClick={() => { setPhase('pick'); setErrorMsg(null) }}
            style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            {t.nutrition.tryAgain}
          </button>
        </div>
      )}
    </div>
  )
}
