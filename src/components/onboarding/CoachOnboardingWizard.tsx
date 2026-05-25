'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Upload, X, Dumbbell, Salad, Layers, Users, UserPlus, Rocket } from 'lucide-react'
import { completeCoachOnboarding, type CoachingFocus, type ClientCountRange } from '@/app/coach/onboarding/actions'
import { uploadCoachAvatar, updateCoachProfile } from '@/app/coach/settings/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4

interface WizardProps {
  coachName: string
  coachAvatarUrl: string | null
  coachId: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ─── Option card ─────────────────────────────────────────────────────────────

function OptionCard({
  selected,
  onClick,
  icon: Icon,
  label,
  description,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 18px',
        borderRadius: 12,
        border: `2px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
        backgroundColor: selected ? 'rgba(var(--color-accent-rgb, 255,107,53),0.08)' : 'var(--color-surface-2)',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: selected ? 'var(--color-accent)' : 'var(--color-surface-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background-color 0.15s',
        }}
      >
        <Icon size={18} color={selected ? '#fff' : 'var(--color-text-muted)'} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
          {label}
        </p>
        {description && (
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
            {description}
          </p>
        )}
      </div>
      {selected && (
        <div
          style={{
            marginLeft: 'auto',
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Check size={11} color="#fff" strokeWidth={3} />
        </div>
      )}
    </button>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: Step; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 32 }}>
      {Array.from({ length: total }, (_, i) => {
        const idx = (i + 1) as Step
        const done = idx < current
        const active = idx === current
        return (
          <div
            key={i}
            style={{
              width: active ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: done || active ? 'var(--color-accent)' : 'var(--color-border)',
              transition: 'width 0.2s, background-color 0.2s',
            }}
          />
        )
      })}
    </div>
  )
}

// ─── Step 1: Focus + count ────────────────────────────────────────────────────

function Step1({
  focus,
  setFocus,
  clientCount,
  setClientCount,
  onNext,
}: {
  focus: CoachingFocus | null
  setFocus: (v: CoachingFocus) => void
  clientCount: ClientCountRange | null
  setClientCount: (v: ClientCountRange) => void
  onNext: () => void
}) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-accent)', margin: '0 0 8px' }}>
        Step 1 of 4
      </p>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
        Tell us about your coaching
      </h2>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 28px' }}>
        This helps us personalise the platform for you.
      </p>

      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
        What do you focus on?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        <OptionCard
          selected={focus === 'training'}
          onClick={() => setFocus('training')}
          icon={Dumbbell}
          label="Training"
          description="Workout programmes, sessions, and performance"
        />
        <OptionCard
          selected={focus === 'nutrition'}
          onClick={() => setFocus('nutrition')}
          icon={Salad}
          label="Nutrition"
          description="Meal plans, macros, and diet coaching"
        />
        <OptionCard
          selected={focus === 'both'}
          onClick={() => setFocus('both')}
          icon={Layers}
          label="Both"
          description="Full coaching — training and nutrition together"
        />
      </div>

      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
        How many clients do you currently have?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
        <OptionCard
          selected={clientCount === 'starting'}
          onClick={() => setClientCount('starting')}
          icon={Rocket}
          label="Just starting out"
          description="I'm new to coaching or launching fresh"
        />
        <OptionCard
          selected={clientCount === '1-10'}
          onClick={() => setClientCount('1-10')}
          icon={Users}
          label="1–10 clients"
          description="Small roster, building momentum"
        />
        <OptionCard
          selected={clientCount === '10+'}
          onClick={() => setClientCount('10+')}
          icon={UserPlus}
          label="10+ clients"
          description="Established client base"
        />
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!focus || !clientCount}
        style={{
          width: '100%',
          padding: '14px',
          fontSize: 15,
          fontWeight: 700,
          backgroundColor: !focus || !clientCount ? 'var(--color-surface-3)' : 'var(--color-accent)',
          color: !focus || !clientCount ? 'var(--color-text-hint)' : '#fff',
          border: 'none',
          borderRadius: 12,
          cursor: !focus || !clientCount ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        Continue <ChevronRight size={16} />
      </button>
    </div>
  )
}

// ─── Step 2: Profile setup ────────────────────────────────────────────────────

function Step2({
  displayName,
  setDisplayName,
  avatarUrl,
  setAvatarUrl,
  coachId,
  onNext,
}: {
  displayName: string
  setDisplayName: (v: string) => void
  avatarUrl: string | null
  setAvatarUrl: (v: string | null) => void
  coachId: string
  onNext: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(avatarUrl)

  const initials = getInitials(displayName || 'C')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Instant local preview
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewSrc(ev.target?.result as string)
    reader.readAsDataURL(file)
    // Upload
    setUploading(true)
    setError(null)
    const fd = new FormData()
    fd.append('avatar', file)
    const result = await uploadCoachAvatar(fd)
    setUploading(false)
    if (result.error) { setError(result.error); return }
    if (result.url) setAvatarUrl(result.url)
  }

  async function handleContinue() {
    if (!displayName.trim()) return
    setSaving(true)
    setError(null)
    const result = await updateCoachProfile(coachId, displayName.trim())
    setSaving(false)
    if (result.error) { setError(result.error); return }
    onNext()
  }

  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-accent)', margin: '0 0 8px' }}>
        Step 2 of 4
      </p>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
        Set up your profile
      </h2>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 28px' }}>
        Your clients will see this information.
      </p>

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            backgroundColor: previewSrc ? 'transparent' : 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 800,
            color: '#fff',
            overflow: 'hidden',
            flexShrink: 0,
            border: '2px solid var(--color-border)',
          }}
        >
          {previewSrc
            ? <img src={previewSrc} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials}
        </div>
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 600,
              backgroundColor: 'var(--color-surface-2)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              cursor: uploading ? 'wait' : 'pointer',
              marginBottom: 6,
            }}
          >
            <Upload size={14} />
            {uploading ? 'Uploading…' : 'Upload photo'}
          </button>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-hint)' }}>
            JPG, PNG or WebP · max 5 MB
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Display name */}
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
        Display name
      </label>
      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Your full name"
        style={{
          width: '100%',
          padding: '12px 14px',
          fontSize: 14,
          color: 'var(--color-text-primary)',
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          outline: 'none',
          boxSizing: 'border-box',
          marginBottom: 28,
        }}
      />

      {error && (
        <p style={{ fontSize: 13, color: '#ef4444', margin: '-16px 0 16px' }}>{error}</p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!displayName.trim() || saving || uploading}
        style={{
          width: '100%',
          padding: '14px',
          fontSize: 15,
          fontWeight: 700,
          backgroundColor: !displayName.trim() || saving || uploading ? 'var(--color-surface-3)' : 'var(--color-accent)',
          color: !displayName.trim() || saving || uploading ? 'var(--color-text-hint)' : '#fff',
          border: 'none',
          borderRadius: 12,
          cursor: !displayName.trim() || saving || uploading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {saving ? 'Saving…' : <><span>Continue</span> <ChevronRight size={16} /></>}
      </button>
    </div>
  )
}

// ─── Step 3: Invite first client ──────────────────────────────────────────────

function Step3({
  onNext,
  onSkip,
}: {
  onNext: () => void
  onSkip: () => void
}) {
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleInvite() {
    if (!clientEmail.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clientEmail.trim(), role: 'client' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send invite')
        return
      }
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-accent)', margin: '0 0 8px' }}>
          Step 3 of 4
        </p>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            backgroundColor: 'rgba(34,197,94,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Check size={24} color="#22c55e" />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Invite sent!
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 32px' }}>
          {clientName.trim()
            ? `${clientName.trim()} will receive an email with a link to create their account.`
            : `An invite was sent to ${clientEmail}. They'll receive a link to create their account.`}
        </p>
        <button
          type="button"
          onClick={onNext}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: 15,
            fontWeight: 700,
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          Continue <ChevronRight size={16} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-accent)', margin: '0 0 8px' }}>
        Step 3 of 4
      </p>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
        Invite your first client
      </h2>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 28px' }}>
        They'll get an email with a link to create their account and complete onboarding.
      </p>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
        Client name
      </label>
      <input
        type="text"
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
        placeholder="e.g. Alex Johnson"
        style={{
          width: '100%',
          padding: '12px 14px',
          fontSize: 14,
          color: 'var(--color-text-primary)',
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          outline: 'none',
          boxSizing: 'border-box',
          marginBottom: 16,
        }}
      />

      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
        Client email <span style={{ color: 'var(--color-accent)' }}>*</span>
      </label>
      <input
        type="email"
        value={clientEmail}
        onChange={(e) => setClientEmail(e.target.value)}
        placeholder="client@example.com"
        style={{
          width: '100%',
          padding: '12px 14px',
          fontSize: 14,
          color: 'var(--color-text-primary)',
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          outline: 'none',
          boxSizing: 'border-box',
          marginBottom: error ? 8 : 28,
        }}
      />

      {error && (
        <p style={{ fontSize: 13, color: '#ef4444', margin: '0 0 16px' }}>{error}</p>
      )}

      <button
        type="button"
        onClick={handleInvite}
        disabled={loading || !clientEmail.trim()}
        style={{
          width: '100%',
          padding: '14px',
          fontSize: 15,
          fontWeight: 700,
          backgroundColor: loading || !clientEmail.trim() ? 'var(--color-surface-3)' : 'var(--color-accent)',
          color: loading || !clientEmail.trim() ? 'var(--color-text-hint)' : '#fff',
          border: 'none',
          borderRadius: 12,
          cursor: loading || !clientEmail.trim() ? 'not-allowed' : 'pointer',
          marginBottom: 12,
        }}
      >
        {loading ? 'Sending invite…' : 'Send invite'}
      </button>

      <button
        type="button"
        onClick={onSkip}
        style={{
          width: '100%',
          padding: '12px',
          fontSize: 14,
          fontWeight: 500,
          backgroundColor: 'transparent',
          color: 'var(--color-text-muted)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          cursor: 'pointer',
        }}
      >
        Skip for now
      </button>
    </div>
  )
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function Step4({
  coachName,
  onFinish,
  finishing,
}: {
  coachName: string
  onFinish: () => void
  finishing: boolean
}) {
  const first = coachName.trim().split(/\s+/)[0] ?? 'Coach'
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-accent)', margin: '0 0 16px' }}>
        Step 4 of 4
      </p>

      {/* Animated checkmark circle */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          backgroundColor: 'var(--color-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 0 0 12px rgba(var(--color-accent-rgb, 255,107,53),0.12)',
        }}
      >
        <Check size={32} color="#fff" strokeWidth={2.5} />
      </div>

      <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
        You're all set, {first}!
      </h2>
      <p style={{ fontSize: 15, color: 'var(--color-text-muted)', margin: '0 0 36px', lineHeight: 1.6, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
        Your coaching console is ready. Head to the dashboard to manage clients, check-ins, programmes, and more.
      </p>

      <button
        type="button"
        onClick={onFinish}
        disabled={finishing}
        style={{
          width: '100%',
          padding: '15px',
          fontSize: 15,
          fontWeight: 700,
          backgroundColor: finishing ? 'var(--color-surface-3)' : 'var(--color-accent)',
          color: finishing ? 'var(--color-text-hint)' : '#fff',
          border: 'none',
          borderRadius: 12,
          cursor: finishing ? 'wait' : 'pointer',
          letterSpacing: '-0.01em',
        }}
      >
        {finishing ? 'Saving…' : 'Go to dashboard'}
      </button>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function CoachOnboardingWizard({ coachName, coachAvatarUrl, coachId }: WizardProps) {
  const router = useRouter()

  // Step 1 state
  const [focus, setFocus] = useState<CoachingFocus | null>(null)
  const [clientCount, setClientCount] = useState<ClientCountRange | null>(null)

  // Step 2 state
  const [displayName, setDisplayName] = useState(coachName)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(coachAvatarUrl)

  // Wizard navigation
  const [step, setStep] = useState<Step>(1)
  const [finishing, setFinishing] = useState(false)

  async function handleFinish() {
    if (!focus || !clientCount) return
    setFinishing(true)
    await completeCoachOnboarding(focus, clientCount)
    // Hard refresh so layout re-fetches onboarding_completed and hides wizard
    router.refresh()
  }

  return (
    /* Full-screen overlay */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Modal card */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 20,
          padding: '36px 32px',
          position: 'relative',
        }}
      >
        <StepDots current={step} total={4} />

        {step === 1 && (
          <Step1
            focus={focus}
            setFocus={setFocus}
            clientCount={clientCount}
            setClientCount={setClientCount}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <Step2
            displayName={displayName}
            setDisplayName={setDisplayName}
            avatarUrl={avatarUrl}
            setAvatarUrl={setAvatarUrl}
            coachId={coachId}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <Step3
            onNext={() => setStep(4)}
            onSkip={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <Step4
            coachName={displayName || coachName}
            onFinish={handleFinish}
            finishing={finishing}
          />
        )}
      </div>
    </div>
  )
}
