'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  LogOut, ChevronRight, ChevronLeft, Bell, Moon, Shield, HelpCircle,
  User, Camera, Eye, EyeOff, Check, ChevronDown, ChevronUp, Send, BarChart2,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { updatePersonalInfo, uploadAvatar, sendFeedbackToCoach } from './actions'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type Panel = 'personal-info' | 'notifications' | 'appearance' | 'privacy-security' | 'help-feedback' | null

type NotifPrefs = {
  pushEnabled: boolean
  emailEnabled: boolean
  checkinReminders: boolean
  workoutReminders: boolean
  coachMessages: boolean
}

type Props = {
  userId: string
  email: string
  avatarUrl: string | null
  clientId: string
  fullName: string
  phone: string | null
  coachId: string | null
  workspaceId: string
  weekNumber: number
  totalWeeks: number
}

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  pushEnabled: true,
  emailEnabled: true,
  checkinReminders: true,
  workoutReminders: true,
  coachMessages: true,
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-1)',
  border: '1px solid var(--color-border)',
  borderRadius: 14,
  overflow: 'hidden',
}

const rowBase: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '14px 16px',
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--color-border)',
  cursor: 'pointer',
  textAlign: 'left',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  backgroundColor: 'var(--color-surface-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  color: 'var(--color-text-primary)',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
}

const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  backgroundColor: 'var(--color-accent)',
  border: 'none',
  borderRadius: 12,
  color: '#fff',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({ open, onBack, title, children }: {
  open: boolean
  onBack: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        backgroundColor: 'var(--color-base)',
        overflowY: 'auto',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        paddingBottom: 80,
      }}
    >
      {/* Panel header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '52px 16px 16px',
          backgroundColor: 'var(--color-base)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: 'var(--color-surface-2)',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            color: 'var(--color-text-primary)',
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {title}
        </h2>
      </div>

      <div style={{ padding: '20px 16px' }}>{children}</div>
    </div>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 44,
        height: 26,
        borderRadius: 13,
        backgroundColor: checked ? 'var(--color-accent)' : 'var(--color-surface-3)',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          backgroundColor: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  )
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({ label, sub, checked, onChange, isLast = false }: {
  label: string
  sub?: string
  checked: boolean
  onChange: (v: boolean) => void
  isLast?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
        gap: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{label}</p>
        {sub && <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '2px 0 0' }}>{sub}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'How do I log a workout?',
    a: 'Go to the Train tab, select your scheduled session, and tap "Start Workout." Log each set as you complete it, then tap "Finish Workout" to save.',
  },
  {
    q: 'How do I track my nutrition?',
    a: 'Go to the Food tab and use the search bar to find foods. You can log meals by type (breakfast, lunch, dinner, snacks) throughout the day.',
  },
  {
    q: 'When is my check-in due?',
    a: 'Check-ins are due every Sunday. You\'ll see a reminder on your home screen when the window opens. Complete it before it closes on Monday morning.',
  },
  {
    q: 'How do I message my coach?',
    a: 'Use the Messages tab at the bottom of the screen to send your coach a message at any time.',
  },
  {
    q: 'Can I request changes to my program?',
    a: 'Yes — message your coach through the Messages tab. They can adjust your workouts, nutrition plan, or goals at any time.',
  },
  {
    q: 'What if I miss a workout?',
    a: "Don't stress about it. Consistency over time matters more than any single session. Let your coach know if you're struggling and they can help adjust your schedule.",
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>{q}</span>
        {open ? <ChevronUp size={15} color="var(--color-text-hint)" /> : <ChevronDown size={15} color="var(--color-text-hint)" />}
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px' }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>{a}</p>
        </div>
      )}
    </div>
  )
}

// ─── Password strength ────────────────────────────────────────────────────────

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' }
  if (score <= 3) return { score, label: 'Fair', color: '#f59e0b' }
  return { score, label: 'Strong', color: '#22c55e' }
}

// ─── Personal Info Panel ──────────────────────────────────────────────────────

function PersonalInfoPanel({ open, onBack, clientId, fullName, email, phone, avatarUrl, onSaved }: {
  open: boolean
  onBack: () => void
  clientId: string
  fullName: string
  email: string
  phone: string | null
  avatarUrl: string | null
  onSaved: (name: string, phone: string | null, avatarUrl: string | null) => void
}) {
  const [name, setName] = useState(fullName)
  const [phoneVal, setPhoneVal] = useState(phone ?? '')
  const [avatar, setAvatar] = useState<string | null>(avatarUrl)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(fullName)
      setPhoneVal(phone ?? '')
      setAvatar(avatarUrl)
    }
  }, [open, fullName, phone, avatarUrl])

  const initials = name.trim().split(' ').map((p) => p[0]?.toUpperCase() ?? '').join('').slice(0, 2) || '?'

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }

    // Show local preview immediately
    const reader = new FileReader()
    reader.onload = (ev) => setAvatar(ev.target?.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    const fd = new FormData()
    fd.append('avatar', file)
    const result = await uploadAvatar(fd)
    setUploading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      setAvatar(result.url)
      toast.success('Profile photo updated')
    }
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const result = await updatePersonalInfo(clientId, name, phoneVal)
    setSaving(false)
    if (result.error) { toast.error(result.error); return }
    toast.success('Profile saved')
    onSaved(name.trim(), phoneVal.trim() || null, avatar)
    onBack()
  }

  return (
    <Panel open={open} onBack={onBack} title="Personal Info">
      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              backgroundColor: avatar ? 'transparent' : 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 800,
              color: '#fff',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {avatar
              ? <img src={avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: 'var(--color-accent)',
              border: '2px solid var(--color-base)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            <Camera size={13} color="#fff" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: 0 }}>
          {uploading ? 'Uploading…' : 'Tap the camera icon to change your photo'}
        </p>
      </div>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
            Full Name
          </label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
            Email
          </label>
          <input
            style={{ ...inputStyle, color: 'var(--color-text-hint)', cursor: 'not-allowed' }}
            value={email}
            readOnly
            title="Email cannot be changed"
          />
          <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: '5px 0 0' }}>Contact your coach to change your email address.</p>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
            Phone (optional)
          </label>
          <input
            style={inputStyle}
            value={phoneVal}
            onChange={(e) => setPhoneVal(e.target.value)}
            placeholder="+1 234 567 8900"
            type="tel"
            autoComplete="tel"
          />
        </div>

        <button type="button" onClick={handleSave} disabled={saving} style={{ ...primaryBtn, marginTop: 8, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </Panel>
  )
}

// ─── Notifications Panel ──────────────────────────────────────────────────────

function NotificationsPanel({ open, onBack, userId }: { open: boolean; onBack: () => void; userId: string }) {
  const storageKey = `notif_prefs_${userId}`
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS)

  useEffect(() => {
    if (!open) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setPrefs({ ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) })
    } catch {
      // ignore
    }
  }, [open, storageKey])

  const update = useCallback((patch: Partial<NotifPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [storageKey])

  return (
    <Panel open={open} onBack={onBack} title="Notifications">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
            Channels
          </p>
          <div style={card}>
            <ToggleRow
              label="Push Notifications"
              sub="In-app alerts on your device"
              checked={prefs.pushEnabled}
              onChange={(v) => update({ pushEnabled: v })}
            />
            <ToggleRow
              label="Email Notifications"
              sub="Updates sent to your email"
              checked={prefs.emailEnabled}
              onChange={(v) => update({ emailEnabled: v })}
              isLast
            />
          </div>
        </div>

        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
            Reminders
          </p>
          <div style={card}>
            <ToggleRow
              label="Check-in Reminders"
              sub="Weekly check-in due reminders"
              checked={prefs.checkinReminders}
              onChange={(v) => update({ checkinReminders: v })}
            />
            <ToggleRow
              label="Workout Reminders"
              sub="Daily training session alerts"
              checked={prefs.workoutReminders}
              onChange={(v) => update({ workoutReminders: v })}
            />
            <ToggleRow
              label="Coach Messages"
              sub="New messages from your coach"
              checked={prefs.coachMessages}
              onChange={(v) => update({ coachMessages: v })}
              isLast
            />
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--color-text-hint)', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
          Preferences are saved on this device. Some notifications are controlled by your device&apos;s system settings.
        </p>
      </div>
    </Panel>
  )
}

// ─── Appearance Panel ─────────────────────────────────────────────────────────

function AppearancePanel({ open, onBack }: { open: boolean; onBack: () => void }) {
  return (
    <Panel open={open} onBack={onBack} title="Appearance">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
          Theme
        </p>

        <div style={card}>
          {/* Dark mode — active */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#111',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Moon size={18} color="var(--color-accent)" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>Dark Mode</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '2px 0 0' }}>Currently active</p>
            </div>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                backgroundColor: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Check size={13} color="#fff" />
            </div>
          </div>

          {/* Light mode — coming soon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              opacity: 0.45,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#f5f5f5',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>Light Mode</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '2px 0 0' }}>Coming soon</p>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--color-text-hint)', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
          Light mode is on the roadmap. Stay tuned for the update.
        </p>
      </div>
    </Panel>
  )
}

// ─── Privacy & Security Panel ─────────────────────────────────────────────────

function PrivacySecurityPanel({ open, onBack, email }: { open: boolean; onBack: () => void; email: string }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setCurrentPw(''); setNewPw(''); setConfirmPw('') }
  }, [open])

  const strength = newPw ? passwordStrength(newPw) : null

  async function handleChangePassword() {
    if (!currentPw) { toast.error('Enter your current password'); return }
    if (newPw.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return }

    setSaving(true)
    const supabase = createClient()

    // Verify current password by re-authenticating
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPw })
    if (signInErr) {
      setSaving(false)
      toast.error('Current password is incorrect')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSaving(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password changed successfully')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
  }

  const eyeBtn: React.CSSProperties = {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    color: 'var(--color-text-hint)',
    display: 'flex',
    alignItems: 'center',
  }

  return (
    <Panel open={open} onBack={onBack} title="Privacy & Security">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Change password */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
            Change Password
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputStyle, paddingRight: 44 }}
                type={showCurrent ? 'text' : 'password'}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
              />
              <button type="button" style={eyeBtn} onClick={() => setShowCurrent((s) => !s)}>
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputStyle, paddingRight: 44 }}
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
              />
              <button type="button" style={eyeBtn} onClick={() => setShowNew((s) => !s)}>
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength indicator */}
            {newPw && strength && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: 'var(--color-surface-3)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(strength.score / 5) * 100}%`,
                      backgroundColor: strength.color,
                      borderRadius: 2,
                      transition: 'width 0.3s, background-color 0.3s',
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: strength.color, flexShrink: 0 }}>{strength.label}</span>
              </div>
            )}

            <input
              style={inputStyle}
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />

            {confirmPw && newPw !== confirmPw && (
              <p style={{ fontSize: 12, color: '#ef4444', margin: '-4px 0 0' }}>Passwords do not match</p>
            )}

            <button
              type="button"
              onClick={handleChangePassword}
              disabled={saving}
              style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        </div>

        {/* Data & Privacy info */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
            Data & Privacy
          </p>
          <div style={{ ...card, overflow: 'visible' }}>
            {[
              { title: 'Your data is encrypted', desc: 'All personal data is stored securely with industry-standard encryption.' },
              { title: 'Private by default', desc: 'Your progress and health data is only visible to you and your coach.' },
              { title: 'No third-party sharing', desc: 'We never sell or share your personal information with third parties.' },
            ].map((item, i, arr) => (
              <div
                key={item.title}
                style={{
                  padding: '14px 16px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--color-accent)', flexShrink: 0 }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{item.title}</p>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '0 0 0 14px', lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}

// ─── Help & Feedback Panel ────────────────────────────────────────────────────

function HelpFeedbackPanel({ open, onBack, clientId, workspaceId, coachId }: {
  open: boolean
  onBack: () => void
  clientId: string
  workspaceId: string
  coachId: string | null
}) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!message.trim()) { toast.error('Write a message first'); return }
    if (!coachId) { toast.error('No coach assigned yet'); return }
    setSending(true)
    const result = await sendFeedbackToCoach(clientId, workspaceId, coachId, message)
    setSending(false)
    if (result.error) { toast.error(result.error) } else {
      toast.success('Message sent to your coach')
      setMessage('')
    }
  }

  return (
    <Panel open={open} onBack={onBack} title="Help & Feedback">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* FAQs */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
            Frequently Asked Questions
          </p>
          <div style={{ ...card, overflow: 'visible' }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <FaqItem q={faq.q} a={faq.a} />
              </div>
            ))}
          </div>
        </div>

        {/* Contact coach */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
            Contact Your Coach
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask a question or share feedback with your coach…"
              rows={5}
              style={{
                ...inputStyle,
                resize: 'none',
                lineHeight: 1.6,
                fontFamily: 'inherit',
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !coachId}
              style={{
                ...primaryBtn,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: sending || !coachId ? 0.6 : 1,
                cursor: sending || !coachId ? 'not-allowed' : 'pointer',
              }}
            >
              <Send size={16} />
              {sending ? 'Sending…' : 'Send to Coach'}
            </button>
            {!coachId && (
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', textAlign: 'center', margin: 0 }}>
                You&apos;ll be able to message your coach once one is assigned to you.
              </p>
            )}
          </div>
        </div>
      </div>
    </Panel>
  )
}

// ─── Main Profile component ───────────────────────────────────────────────────

export default function ProfileClient({
  userId, email, avatarUrl, clientId, fullName, phone, coachId, workspaceId, weekNumber, totalWeeks,
}: Props) {
  const router = useRouter()
  const [activePanel, setActivePanel] = useState<Panel>(null)

  // Local state updated after saves
  const [displayName, setDisplayName] = useState(fullName)
  const [displayPhone, setDisplayPhone] = useState(phone)
  const [displayAvatar, setDisplayAvatar] = useState(avatarUrl)

  const initials = displayName.trim().split(' ').map((p) => p[0]?.toUpperCase() ?? '').join('').slice(0, 2) || '?'

  const MENU_SECTIONS = [
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Personal info', sub: 'Name, photo, phone', panel: 'personal-info' as Panel },
        { icon: Bell, label: 'Notifications', sub: 'Push & email preferences', panel: 'notifications' as Panel },
        { icon: Moon, label: 'Appearance', sub: 'Dark mode', panel: 'appearance' as Panel },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: Shield, label: 'Privacy & security', sub: 'Change password, data', panel: 'privacy-security' as Panel },
        { icon: HelpCircle, label: 'Help & feedback', sub: 'FAQs, contact coach', panel: 'help-feedback' as Panel },
      ],
    },
  ]

  async function handleSignOut() {
    await fetch('/api/auth/signout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <>
      {/* ── Main profile view ── */}
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 32 }}>

        {/* Header */}
        <div style={{ padding: '52px 20px 24px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Profile
          </h1>
        </div>

        {/* Avatar card */}
        <div style={{ padding: '0 16px 20px' }}>
          <div
            style={{
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 16,
              padding: '20px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: displayAvatar ? 'transparent' : 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 20,
                fontWeight: 800,
                color: '#fff',
                letterSpacing: '0.02em',
                overflow: 'hidden',
              }}
            >
              {displayAvatar
                ? <img src={displayAvatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-hint)', margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email}
              </p>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'var(--color-accent-dim)',
                  borderRadius: 999,
                  padding: '4px 10px',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--color-accent)', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-accent)' }}>
                  Week {weekNumber} of {totalWeeks}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress button */}
        <div style={{ padding: '0 16px 16px' }}>
          <Link
            href="/client/progress"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 14,
              textDecoration: 'none',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: 'var(--color-accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <BarChart2 size={17} color="var(--color-accent)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.3 }}>Progress</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '1px 0 0' }}>Weight, check-ins, photos</p>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />
          </Link>
        </div>

        {/* Menu sections */}
        {MENU_SECTIONS.map((section) => (
          <div key={section.title} style={{ padding: '0 16px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
              {section.title}
            </p>
            <div style={card}>
              {section.items.map((item, idx) => {
                const Icon = item.icon
                const isLast = idx === section.items.length - 1
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActivePanel(item.panel)}
                    style={{ ...rowBase, borderBottom: isLast ? 'none' : '1px solid var(--color-border)' }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: 'var(--color-surface-3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={17} style={{ color: 'var(--color-text-secondary)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.3 }}>{item.label}</p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '1px 0 0' }}>{item.sub}</p>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Sign out */}
        <div style={{ padding: '4px 16px 0' }}>
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '15px',
              backgroundColor: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 14,
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
              color: '#ef4444',
            }}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </div>

      {/* ── Panels (stacked above main view) ── */}
      <PersonalInfoPanel
        open={activePanel === 'personal-info'}
        onBack={() => setActivePanel(null)}
        clientId={clientId}
        fullName={displayName}
        email={email}
        phone={displayPhone}
        avatarUrl={displayAvatar}
        onSaved={(name, ph, av) => { setDisplayName(name); setDisplayPhone(ph); setDisplayAvatar(av) }}
      />

      <NotificationsPanel
        open={activePanel === 'notifications'}
        onBack={() => setActivePanel(null)}
        userId={userId}
      />

      <AppearancePanel
        open={activePanel === 'appearance'}
        onBack={() => setActivePanel(null)}
      />

      <PrivacySecurityPanel
        open={activePanel === 'privacy-security'}
        onBack={() => setActivePanel(null)}
        email={email}
      />

      <HelpFeedbackPanel
        open={activePanel === 'help-feedback'}
        onBack={() => setActivePanel(null)}
        clientId={clientId}
        workspaceId={workspaceId}
        coachId={coachId}
      />
    </>
  )
}
