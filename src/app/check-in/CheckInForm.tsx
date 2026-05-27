'use client'

import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ensureDefaultTemplate, getClientByEmail, uploadProgressPhoto, submitCheckin, getExistingCheckin } from './actions'
import type { Question, ChoiceOption } from './actions'
import { getSundayStart, getNextSundayMidnight, formatCountdown } from '@/lib/checkin-window'
import { useLanguage, type Translations } from '@/lib/i18n'

// Map DB question ids to translation keys
function getQLabel(id: string, fallback: string, t: Translations): string {
  const m: Record<string, string> = {
    current_weight:      t.checkin.q.currentWeight,
    performance_rating:  t.checkin.q.performance,
    nutrition_adherence: t.checkin.q.nutritionAdherence,
    training_adherence:  t.checkin.q.trainingAdherence,
    sleep_quality:       t.checkin.q.sleep,
    stress_level:        t.checkin.q.stress,
    energy_level:        t.checkin.q.energy,
    biggest_win:         t.checkin.q.biggestWin,
    biggest_challenge:   t.checkin.q.biggestChallenge,
    schedule_changes:    t.checkin.q.scheduleChanges,
    anything_else:       t.checkin.q.anythingElse,
    progress_photo:      t.checkin.q.progressPhoto,
  }
  return m[id] ?? fallback
}

// Map English contributor chip labels (canonical) to translation keys
function translateChip(chip: string, t: Translations): string {
  const m: Record<string, string> = {
    'Better sleep': t.checkin.chips.betterSleep,
    'Less work stress': t.checkin.chips.lessWorkStress,
    'Hit my protein': t.checkin.chips.hitProtein,
    'Walked more': t.checkin.chips.walkedMore,
    'Hydration': t.checkin.chips.hydration,
    'Caffeine timing': t.checkin.chips.caffeineTiming,
    'Earlier bedtime': t.checkin.chips.earlierBedtime,
    'Less screen time': t.checkin.chips.lessScreenTime,
    'Magnesium': t.checkin.chips.magnesium,
    'No caffeine PM': t.checkin.chips.noCaffeinePm,
    'Cool room': t.checkin.chips.coolRoom,
    'Meditation': t.checkin.chips.meditation,
    'Exercise': t.checkin.chips.exercise,
    'Journaling': t.checkin.chips.journaling,
    'Less work': t.checkin.chips.lessWork,
    'Extra rest': t.checkin.chips.extraRest,
    'Better nutrition': t.checkin.chips.betterNutrition,
    'Good warm up': t.checkin.chips.goodWarmUp,
    'Peaked well': t.checkin.chips.peakedWell,
    'Meal prep': t.checkin.chips.mealPrep,
    'Tracked macros': t.checkin.chips.trackedMacros,
    'Less dining out': t.checkin.chips.lessDiningOut,
    'Avoided junk': t.checkin.chips.avoidedJunk,
    'Cooked at home': t.checkin.chips.cookedAtHome,
    'Good schedule': t.checkin.chips.goodSchedule,
    'Workout partner': t.checkin.chips.workoutPartner,
    'High motivation': t.checkin.chips.highMotivation,
    'Good recovery': t.checkin.chips.goodRecovery,
    'Planned sessions': t.checkin.chips.plannedSessions,
    'No injuries': t.checkin.chips.noInjuries,
  }
  return m[chip] ?? chip
}

// ─── Color helpers ─────────────────────────────────────────────────────────────

function scaleColor(normalized: number): string {
  const hue = Math.round(normalized * 140)
  return `hsl(${hue}, 75%, 55%)`
}

function scaleValueColor(value: number, inverted: boolean): string {
  const raw = (value - 1) / 9
  return scaleColor(inverted ? 1 - raw : raw)
}

function adherenceColor(pct: number): string {
  return scaleColor(pct / 100)
}

function getValueLabel(value: number, id: string, t: Translations): string {
  const inverted = id === 'stress_level'
  const normalized = inverted ? 1 - (value - 1) / 9 : (value - 1) / 9
  if (normalized >= 0.8) return t.checkin.scaleExcellent
  if (normalized >= 0.65) return t.checkin.scaleHigh
  if (normalized >= 0.45) return t.checkin.scaleAverage
  if (normalized >= 0.25) return t.checkin.scaleBelow
  return t.checkin.scaleLow
}

// ─── Per-question metadata ─────────────────────────────────────────────────────

function getCategory(id: string, t: Translations): string {
  const m: Record<string, string> = {
    current_weight:      t.checkin.cat.body,
    performance_rating:  t.checkin.cat.training,
    nutrition_adherence: t.checkin.cat.nutrition,
    training_adherence:  t.checkin.cat.training,
    sleep_quality:       t.checkin.cat.recovery,
    stress_level:        t.checkin.cat.recovery,
    energy_level:        t.checkin.cat.energy,
    biggest_win:         t.checkin.cat.reflection,
    biggest_challenge:   t.checkin.cat.reflection,
    schedule_changes:    t.checkin.cat.lifestyle,
    anything_else:       t.checkin.cat.notes,
    progress_photo:      t.checkin.cat.progress,
  }
  return m[id] ?? ''
}

function getHint(id: string, t: Translations): string {
  const m: Record<string, string> = {
    performance_rating:  t.checkin.hint.performance,
    sleep_quality:       t.checkin.hint.sleep,
    stress_level:        t.checkin.hint.stress,
    energy_level:        t.checkin.hint.energy,
    nutrition_adherence: t.checkin.hint.nutrition,
    training_adherence:  t.checkin.hint.training,
  }
  return m[id] ?? ''
}

const Q_CONTRIBUTORS: Record<string, string[]> = {
  energy_level:        ['Better sleep', 'Less work stress', 'Hit my protein', 'Walked more', 'Hydration', 'Caffeine timing'],
  sleep_quality:       ['Earlier bedtime', 'Less screen time', 'Magnesium', 'No caffeine PM', 'Cool room'],
  stress_level:        ['Meditation', 'Exercise', 'Better sleep', 'Journaling', 'Less work'],
  performance_rating:  ['Extra rest', 'Better nutrition', 'Good warm up', 'Hit my protein', 'Peaked well'],
  nutrition_adherence: ['Meal prep', 'Tracked macros', 'Less dining out', 'Avoided junk', 'Hit protein', 'Cooked at home'],
  training_adherence:  ['Good schedule', 'Workout partner', 'High motivation', 'Good recovery', 'Planned sessions', 'No injuries'],
}

// ─── Shared primitives ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--color-text-hint)' }}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.961 3 8.12l3-2.829z" />
    </svg>
  )
}

// ─── Top nav bar ───────────────────────────────────────────────────────────────

function TopNav({
  step,
  total,
  onBack,
  t,
}: {
  step: number
  total: number
  onBack: () => void
  t: Translations
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 52,
        padding: '0 16px',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        aria-label={t.common.back}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-secondary)' }}>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <span
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-text-hint)',
        }}
      >
        {t.checkin.title}
      </span>

      <span
        style={{
          marginLeft: 'auto',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--color-text-hint)',
          whiteSpace: 'nowrap',
        }}
      >
        {t.checkin.stepOf(step + 1, total)}
      </span>
    </div>
  )
}

// ─── Contributor chips ─────────────────────────────────────────────────────────

function ContributorChips({
  questionId,
  selected,
  onChange,
  t,
}: {
  questionId: string
  selected: string[]
  onChange: (v: string[]) => void
  t: Translations
}) {
  const chips = Q_CONTRIBUTORS[questionId]
  const [otherOpen, setOtherOpen] = useState(false)
  const [otherText, setOtherText] = useState('')

  if (!chips) return null

  const toggle = (chip: string) => {
    onChange(
      selected.includes(chip) ? selected.filter((c) => c !== chip) : [...selected, chip]
    )
  }

  const confirmOther = () => {
    const val = otherText.trim()
    if (val && !selected.includes(val)) {
      onChange([...selected, val])
    }
    setOtherText('')
    setOtherOpen(false)
  }

  return (
    <div style={{ marginTop: 24 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-hint)', marginBottom: 10, letterSpacing: '0.04em' }}>
        {t.checkin.whatContributed} <span style={{ fontWeight: 400 }}>({t.common.optional.toLowerCase()})</span>
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {chips.map((chip) => {
          const active = selected.includes(chip)
          return (
            <button
              key={chip}
              type="button"
              onClick={() => toggle(chip)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 999,
                border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                backgroundColor: active ? 'var(--color-accent-dim)' : 'transparent',
                color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              {active && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
              {translateChip(chip, t)}
            </button>
          )
        })}

        {/* Other chip */}
        {!otherOpen ? (
          <button
            type="button"
            onClick={() => setOtherOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 999,
              border: '1.5px dashed var(--color-border)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-hint)',
              cursor: 'pointer',
            }}
          >
            {t.checkin.other}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', marginTop: 2 }}>
            <input
              autoFocus
              type="text"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmOther(); if (e.key === 'Escape') setOtherOpen(false) }}
              placeholder={t.checkin.describeOther}
              style={{
                flex: 1,
                padding: '7px 12px',
                fontSize: 13,
                borderRadius: 999,
                border: '1.5px solid var(--color-accent)',
                backgroundColor: 'var(--color-surface-2)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={confirmOther}
              style={{
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 999,
                border: 'none',
                backgroundColor: 'var(--color-accent)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {t.checkin.addBtn}
            </button>
            <button
              type="button"
              onClick={() => setOtherOpen(false)}
              style={{
                padding: '7px 10px',
                fontSize: 12,
                borderRadius: 999,
                border: '1px solid var(--color-border)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-hint)',
                cursor: 'pointer',
              }}
            >
              {t.common.cancel}
            </button>
          </div>
        )}

        {/* Show added "Other" entries as removable chips */}
        {selected
          .filter((s) => !chips.includes(s))
          .map((custom) => (
            <button
              key={custom}
              type="button"
              onClick={() => onChange(selected.filter((c) => c !== custom))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 999,
                border: '1.5px solid var(--color-accent)',
                backgroundColor: 'var(--color-accent-dim)',
                color: 'var(--color-accent)',
                cursor: 'pointer',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {custom}
            </button>
          ))}
      </div>
    </div>
  )
}

// ─── Answer inputs ─────────────────────────────────────────────────────────────

function NumberInput({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: Translations }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9.]*"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.0"
        style={{
          width: '100%',
          padding: '18px 56px 18px 20px',
          fontSize: 22,
          fontWeight: 600,
          backgroundColor: 'var(--color-surface-2)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 16,
          color: 'var(--color-text-primary)',
          outline: 'none',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
      />
      <span
        style={{
          position: 'absolute',
          right: 20,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--color-text-hint)',
          pointerEvents: 'none',
        }}
      >
        {t.checkin.weightUnit}
      </span>
    </div>
  )
}

function ScaleSlider({
  questionId,
  value,
  inverted,
  onChange,
  t,
}: {
  questionId: string
  value: number | undefined
  inverted: boolean
  onChange: (v: number) => void
  t: Translations
}) {
  const displayVal = value ?? 5
  const valueColor = scaleValueColor(displayVal, inverted)
  const gradient   = inverted
    ? 'linear-gradient(to right, #22c55e, #f97316 50%, #ef4444)'
    : 'linear-gradient(to right, #ef4444, #f97316 50%, #22c55e)'

  const ticks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  return (
    <div>
      {/* Large value centered */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <span
          style={{
            fontSize: 108,
            fontWeight: 800,
            lineHeight: 1,
            color: valueColor,
            fontVariantNumeric: 'tabular-nums',
            transition: 'color 0.1s ease',
            display: 'inline-block',
          }}
        >
          {displayVal}
        </span>
        <span style={{ fontSize: 32, fontWeight: 400, color: 'var(--color-text-hint)', marginLeft: 6, verticalAlign: 'bottom', paddingBottom: 12, display: 'inline-block' }}>
          / 10
        </span>
        <p style={{ fontSize: 14, fontWeight: 600, color: valueColor, marginTop: 6, transition: 'color 0.1s ease' }}>
          {getValueLabel(displayVal, questionId, t)}
        </p>
      </div>

      {/* Slider */}
      <div
        style={{
          '--slider-thumb-color': valueColor,
          '--slider-gradient': gradient,
        } as React.CSSProperties}
      >
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={displayVal}
          className="checkin-scale-slider w-full"
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>

      {/* Tick numbers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {ticks.map((t) => (
          <span
            key={t}
            style={{
              fontSize: 11,
              color: t === displayVal ? valueColor : 'var(--color-text-hint)',
              fontWeight: t === displayVal ? 700 : 400,
              transition: 'color 0.1s ease',
              minWidth: 14,
              textAlign: 'center',
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

function OptionsInput({
  value,
  onChange,
}: {
  value: number | undefined
  onChange: (v: number) => void
}) {
  const displayVal = value ?? 50
  const valueColor = adherenceColor(displayVal)
  const gradient   = 'linear-gradient(to right, #ef4444, #f97316 50%, #22c55e)'
  const ticks      = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <span
          style={{
            fontSize: 108,
            fontWeight: 800,
            lineHeight: 1,
            color: valueColor,
            fontVariantNumeric: 'tabular-nums',
            transition: 'color 0.1s ease',
          }}
        >
          {displayVal}%
        </span>
      </div>

      <div style={{ '--slider-thumb-color': valueColor, '--slider-gradient': gradient } as React.CSSProperties}>
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={displayVal}
          className="checkin-scale-slider w-full"
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {ticks.map((t) => (
          <span
            key={t}
            style={{
              fontSize: 10,
              color: t === displayVal ? valueColor : 'var(--color-text-hint)',
              fontWeight: t === displayVal ? 700 : 400,
              transition: 'color 0.1s ease',
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

function ChoiceInput({
  options,
  value,
  onPick,
}: {
  options: ChoiceOption[]
  value: string | undefined
  onPick: (v: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPick(opt.value)}
            style={{
              padding: '28px 12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              backgroundColor: active ? 'var(--color-accent-dim)' : 'var(--color-surface-2)',
              border: active ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              borderRadius: 16,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
              minHeight: 120,
            }}
          >
            <span style={{ fontSize: 42, lineHeight: 1 }}>{opt.emoji}</span>
            <span style={{ fontSize: 14, fontWeight: 500, textAlign: 'center', color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', lineHeight: 1.3 }}>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function TextInput({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: Translations }) {
  return (
    <textarea
      rows={5}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t.checkin.typeAnswer}
      style={{
        width: '100%',
        marginTop: 16,
        padding: '14px 16px',
        fontSize: 14,
        outline: 'none',
        resize: 'none',
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        color: 'var(--color-text-primary)',
        lineHeight: 1.6,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
    />
  )
}

function PhotoInput({ files, onFilesChange, t }: { files: File[]; onFilesChange: (files: File[]) => void; t: Translations }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const handleAdd = (e: ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? [])
    if (!newFiles.length) return
    const remaining = 3 - files.length
    const toAdd = newFiles.slice(0, remaining)
    onFilesChange([...files, ...toAdd])
    if (inputRef.current) inputRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  const handleRemove = (idx: number) => {
    onFilesChange(files.filter((_, i) => i !== idx))
  }

  return (
    <div style={{ marginTop: 16 }}>
      {/* Gallery picker — no capture attribute so it opens Files/Photos on all platforms */}
      <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" onChange={handleAdd} />
      {/* Camera shortcut — capture forces camera on mobile */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleAdd} />

      {files.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Camera button */}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            style={{
              width: '100%',
              padding: '18px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 14,
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            {t.checkin.takePhoto}
          </button>
          {/* Gallery button */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              width: '100%',
              padding: '18px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              backgroundColor: 'var(--color-surface-2)',
              border: '1px dashed var(--color-border)',
              borderRadius: 14,
              color: 'var(--color-text-hint)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            {t.checkin.chooseGallery}
          </button>
          <span style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-hint)' }}>{t.checkin.upTo3Photos}</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {files.map((file, i) => (
            <div key={i} className="relative" style={{ aspectRatio: '1' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(file)} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" style={{ borderRadius: 12 }} />
              <button
                type="button"
                onClick={() => handleRemove(i)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
          ))}
          {files.length < 3 && (
            <div style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Camera shortcut */}
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
                <span style={{ fontSize: 9 }}>{t.checkin.camera}</span>
              </button>
              {/* Gallery picker */}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px dashed var(--color-border)',
                  borderRadius: 10,
                  color: 'var(--color-text-hint)',
                  cursor: 'pointer',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
                <span style={{ fontSize: 9 }}>{t.checkin.gallery}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Full-screen state screens ─────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', minHeight: '100dvh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-base)' }}>
      <Spinner />
    </div>
  )
}

function CheckinDoneScreen({ justSubmitted, t }: { justSubmitted: boolean; t: Translations }) {
  const [msLeft, setMsLeft] = useState<number>(() => getNextSundayMidnight().getTime() - Date.now())

  useEffect(() => {
    const tick = () => setMsLeft(getNextSundayMidnight().getTime() - Date.now())
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', backgroundColor: 'var(--color-base)' }}>
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>Mitovski</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>Coaching</span>
        </div>

        <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'var(--color-accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-accent)' }}>
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
          {justSubmitted ? t.checkin.youreCheckedIn : t.checkin.alreadyCheckedIn}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 28 }}>
          {justSubmitted ? t.checkin.coachReviewing : t.checkin.coachHasUpdate}
        </p>

        <div style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--color-text-hint)', marginBottom: 4 }}>{t.checkin.nextWindowOpens}</p>
          <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {formatCountdown(msLeft)}
          </p>
        </div>

        <Link
          href="/client"
          style={{
            display: 'block',
            textAlign: 'center',
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            borderRadius: 12,
            padding: '14px',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {t.checkin.backToHome}
        </Link>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type PageStatus = 'loading' | 'ready' | 'already_submitted' | 'success'

export default function CheckInForm() {
  const router = useRouter()
  const { t } = useLanguage()

  const [pageStatus, setPageStatus]     = useState<PageStatus>('loading')
  const [questions, setQuestions]       = useState<Question[]>([])
  const [step, setStep]                 = useState(0)
  const [answers, setAnswers]           = useState<Record<string, string | number>>({})
  const [contributors, setContributors] = useState<Record<string, string[]>>({})
  const [photoFiles, setPhotoFiles]     = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [clientId, setClientId]         = useState('')
  const [workspaceId, setWorkspaceId]   = useState('')
  const [templateId, setTemplateId]     = useState('')

  useEffect(() => {
    const init = async () => {
      let email: string

      const mockCookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith('dev_mock_email='))
        ?.split('=')[1]

      if (mockCookie) {
        email = decodeURIComponent(mockCookie)
      } else {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) { router.replace('/login'); return }
        email = user.email
      }

      const client = await getClientByEmail(email)
      if (!client) { router.replace('/client'); return }

      setClientId(client.id)
      setWorkspaceId(client.workspace_id)

      const weekStart = getSundayStart()
      const alreadySubmitted = await getExistingCheckin(client.id, weekStart)
      if (alreadySubmitted) { setPageStatus('already_submitted'); return }

      const template = await ensureDefaultTemplate(client.workspace_id)
      setTemplateId(template.id)
      setQuestions(template.questions)
      setPageStatus('ready')
    }

    init().catch((err) => {
      console.error('[check-in] init failed:', err)
      setError(t.checkin.loadFailed)
      setPageStatus('ready')
    })
  }, [router, t])

  const total         = questions.length
  const currentQ      = questions[step]
  const progress      = total > 0 ? (step + 1) / total : 0
  const isLast        = step === total - 1
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined
  const hasAnswer     = currentAnswer !== undefined && currentAnswer !== ''
  const category      = currentQ ? getCategory(currentQ.id, t) : ''
  const hint          = currentQ ? getHint(currentQ.id, t) : ''

  const advance = () => {
    if (!isLast) {
      setStep((s) => s + 1)
    } else {
      void handleSubmit()
    }
  }

  const back = () => {
    if (step > 0) setStep((s) => s - 1)
    else router.push('/client')
  }

  const skip = () => {
    setAnswers((prev) => {
      const next = { ...prev }
      delete next[currentQ.id]
      return next
    })
    if (currentQ.id === 'progress_photo') setPhotoFiles([])
    advance()
  }

  const setAnswer = (value: string | number) => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: value }))
  }

  const setContributorForQ = (qId: string, chips: string[]) => {
    setContributors((prev) => ({ ...prev, [qId]: chips }))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    const photoPaths: string[] = []
    if (photoFiles.length > 0) {
      try {
        for (const file of photoFiles) {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('workspaceId', workspaceId)
          fd.append('clientId', clientId)
          photoPaths.push(await uploadProgressPhoto(fd))
        }
      } catch {
        setError(t.checkin.photoFailed)
        setIsSubmitting(false)
        return
      }
    }

    const finalAnswers: Record<string, string | number | string[] | null> = { ...answers }
    if (photoPaths.length > 0) finalAnswers.progress_photo = photoPaths
    // Attach contributors as a separate key per question
    for (const [qId, chips] of Object.entries(contributors)) {
      if (chips.length > 0) finalAnswers[`${qId}_contributors`] = chips
    }

    try {
      await submitCheckin({
        workspace_id:    workspaceId,
        client_id:       clientId,
        template_id:     templateId,
        answers:         finalAnswers,
        week_start_date: getSundayStart(),
      })
    } catch {
      setError(t.checkin.submitFailed)
      setIsSubmitting(false)
      return
    }

    setPageStatus('success')
  }

  // ── Screen routing
  if (pageStatus === 'loading')           return <LoadingScreen />
  if (pageStatus === 'already_submitted') return <CheckinDoneScreen justSubmitted={false} t={t} />
  if (pageStatus === 'success')           return <CheckinDoneScreen justSubmitted={true} t={t} />
  if (!currentQ)                          return <LoadingScreen />

  const canProceed =
    currentQ.optional ||
    currentQ.type === 'scale_1_10' ||
    currentQ.type === 'options' ||
    hasAnswer ||
    (currentQ.type === 'photo' && photoFiles.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: 'var(--color-base)' }}>

      {/* Top nav */}
      <TopNav step={step} total={total} onBack={back} t={t} />

      {/* Progress bar */}
      <div style={{ height: 3, flexShrink: 0, backgroundColor: 'var(--color-surface-3)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #ef4444, #f97316 50%, #22c55e)' }} />
        <div
          style={{
            position: 'absolute', top: 0, right: 0,
            width: `${(1 - progress) * 100}%`,
            height: '100%',
            backgroundColor: 'var(--color-surface-3)',
            transition: 'width 0.35s ease',
          }}
        />
      </div>

      {/* Scrollable content — fills remaining height */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 460,
          width: '100%',
          margin: '0 auto',
          padding: '28px 24px 20px',
        }}>

          {/* Question header — fixed at top */}
          <div style={{ flexShrink: 0 }}>
            {category && (
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: 10 }}>
                {category}
              </p>
            )}
            <h2 style={{ fontSize: 30, fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1.15, marginBottom: hint ? 10 : 0 }}>
              {getQLabel(currentQ.id, currentQ.label, t)}
            </h2>
            {hint && (
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                {hint}
              </p>
            )}
            {currentQ.optional && !hint && (
              <p style={{ fontSize: 13, color: 'var(--color-text-hint)', marginTop: 6 }}>{t.common.optional}</p>
            )}
          </div>

          {/* Answer section — expands to fill remaining space, content centered vertically */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>

            {currentQ.type === 'number' && (
              <NumberInput value={(currentAnswer as string) ?? ''} onChange={setAnswer} t={t} />
            )}

            {currentQ.type === 'scale_1_10' && (
              <>
                <ScaleSlider
                  questionId={currentQ.id}
                  value={currentAnswer as number | undefined}
                  inverted={currentQ.id === 'stress_level'}
                  onChange={setAnswer}
                  t={t}
                />
                {Q_CONTRIBUTORS[currentQ.id] && (
                  <ContributorChips
                    questionId={currentQ.id}
                    selected={contributors[currentQ.id] ?? []}
                    onChange={(chips) => setContributorForQ(currentQ.id, chips)}
                    t={t}
                  />
                )}
              </>
            )}

            {currentQ.type === 'options' && (
              <>
                <OptionsInput
                  value={currentAnswer as number | undefined}
                  onChange={setAnswer}
                />
                {Q_CONTRIBUTORS[currentQ.id] && (
                  <ContributorChips
                    questionId={currentQ.id}
                    selected={contributors[currentQ.id] ?? []}
                    onChange={(chips) => setContributorForQ(currentQ.id, chips)}
                    t={t}
                  />
                )}
              </>
            )}

            {currentQ.type === 'choice' && currentQ.choiceOptions && (
              <ChoiceInput
                options={currentQ.choiceOptions}
                value={currentAnswer as string | undefined}
                onPick={setAnswer}
              />
            )}

            {currentQ.type === 'text' && (
              <TextInput value={(currentAnswer as string) ?? ''} onChange={setAnswer} t={t} />
            )}

            {currentQ.type === 'photo' && (
              <PhotoInput files={photoFiles} onFilesChange={setPhotoFiles} t={t} />
            )}

            {error && (
              <div style={{ marginTop: 16, padding: '12px 16px', fontSize: 13, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#ef4444' }}>
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky bottom navigation */}
      <div
        style={{
          flexShrink: 0,
          padding: '10px 22px 28px',
          borderTop: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-base)',
        }}
      >
        {currentQ.optional && (currentQ.type === 'text' || currentQ.type === 'number' || currentQ.type === 'photo') && (
          <button
            type="button"
            onClick={skip}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--color-text-hint)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              marginBottom: 8,
              padding: '6px 0',
            }}
          >
            {t.common.skipQuestion}
          </button>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          {step > 0 && (
            <button
              type="button"
              onClick={back}
              style={{
                flex: '0 0 auto',
                padding: '0 22px',
                height: 56,
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 14,
                border: '1.5px solid var(--color-border)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t.common.back}
            </button>
          )}
          <button
            type="button"
            onClick={advance}
            disabled={isSubmitting || !canProceed}
            style={{
              flex: 1,
              height: 56,
              fontSize: 16,
              fontWeight: 700,
              borderRadius: 14,
              border: 'none',
              backgroundColor: canProceed ? 'var(--color-accent)' : 'var(--color-surface-3)',
              color: canProceed ? '#fff' : 'var(--color-text-hint)',
              cursor: canProceed ? 'pointer' : 'default',
              transition: 'background-color 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {isSubmitting ? t.common.submitting : isLast ? t.common.submit : (
              <>
                {t.common.next}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
