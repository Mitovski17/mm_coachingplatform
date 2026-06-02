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
import { useLanguage, type Translations, type Lang } from '@/lib/i18n'
import { useTheme } from '@/app/ThemeProvider'

// ─── Types ────────────────────────────────────────────────────────────────────

type Panel = 'personal-info' | 'notifications' | 'appearance' | 'privacy-security' | 'help-feedback' | 'preferences' | null

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

function getFaqs(t: Translations) {
  return [
    { q: t.profile.faq.q1, a: t.profile.faq.a1 },
    { q: t.profile.faq.q2, a: t.profile.faq.a2 },
    { q: t.profile.faq.q3, a: t.profile.faq.a3 },
    { q: t.profile.faq.q4, a: t.profile.faq.a4 },
    { q: t.profile.faq.q5, a: t.profile.faq.a5 },
    { q: t.profile.faq.q6, a: t.profile.faq.a6 },
  ]
}

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

function passwordStrength(pw: string, t: Translations): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: t.profile.pwWeak, color: '#ef4444' }
  if (score <= 3) return { score, label: t.profile.pwFair, color: '#f59e0b' }
  return { score, label: t.profile.pwStrong, color: '#22c55e' }
}

// ─── Personal Info Panel ──────────────────────────────────────────────────────

function PersonalInfoPanel({ open, onBack, clientId, fullName, email, phone, avatarUrl, onSaved, t }: {
  open: boolean
  onBack: () => void
  clientId: string
  fullName: string
  email: string
  phone: string | null
  avatarUrl: string | null
  onSaved: (name: string, phone: string | null, avatarUrl: string | null) => void
  t: Translations
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
    if (!file.type.startsWith('image/')) { toast.error(t.profile.pickImage); return }

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
      toast.success(t.profile.profilePhotoUpdated)
    }
  }

  async function handleSave() {
    if (!name.trim()) { toast.error(t.profile.nameRequired); return }
    setSaving(true)
    const result = await updatePersonalInfo(clientId, name, phoneVal)
    setSaving(false)
    if (result.error) { toast.error(result.error); return }
    toast.success(t.profile.profileSaved)
    onSaved(name.trim(), phoneVal.trim() || null, avatar)
    onBack()
  }

  return (
    <Panel open={open} onBack={onBack} title={t.profile.personalInfoTitle}>
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
          {uploading ? t.profile.uploading : t.profile.tapCamera}
        </p>
      </div>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
            {t.profile.fullName}
          </label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.profile.yourFullName}
            autoComplete="name"
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
            {t.profile.email}
          </label>
          <input
            style={{ ...inputStyle, color: 'var(--color-text-hint)', cursor: 'not-allowed' }}
            value={email}
            readOnly
            title={t.profile.emailCantChange}
          />
          <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: '5px 0 0' }}>{t.profile.emailCantChange}</p>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
            {t.profile.phoneOptional}
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
          {saving ? t.common.saving : t.common.saveChanges}
        </button>
      </div>
    </Panel>
  )
}

// ─── Notifications Panel ──────────────────────────────────────────────────────

function NotificationsPanel({ open, onBack, userId, t }: { open: boolean; onBack: () => void; userId: string; t: Translations }) {
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
    <Panel open={open} onBack={onBack} title={t.profile.notifications}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
            {t.profile.channels}
          </p>
          <div style={card}>
            <ToggleRow
              label={t.profile.pushNotifs}
              sub={t.profile.pushNotifsSub}
              checked={prefs.pushEnabled}
              onChange={(v) => update({ pushEnabled: v })}
            />
            <ToggleRow
              label={t.profile.emailNotifs}
              sub={t.profile.emailNotifsSub}
              checked={prefs.emailEnabled}
              onChange={(v) => update({ emailEnabled: v })}
              isLast
            />
          </div>
        </div>

        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
            {t.profile.reminders}
          </p>
          <div style={card}>
            <ToggleRow
              label={t.profile.checkinReminders}
              sub={t.profile.checkinRemindersSub}
              checked={prefs.checkinReminders}
              onChange={(v) => update({ checkinReminders: v })}
            />
            <ToggleRow
              label={t.profile.workoutReminders}
              sub={t.profile.workoutRemindersSub}
              checked={prefs.workoutReminders}
              onChange={(v) => update({ workoutReminders: v })}
            />
            <ToggleRow
              label={t.profile.coachMessages}
              sub={t.profile.coachMessagesSub}
              checked={prefs.coachMessages}
              onChange={(v) => update({ coachMessages: v })}
              isLast
            />
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--color-text-hint)', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
          {t.profile.notifsHint}
        </p>
      </div>
    </Panel>
  )
}

// ─── Appearance Panel ─────────────────────────────────────────────────────────

function AppearancePanel({ open, onBack, t }: { open: boolean; onBack: () => void; t: Translations }) {
  const { theme, setTheme } = useTheme()

  return (
    <Panel open={open} onBack={onBack} title={t.profile.appearance}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
          {t.profile.theme}
        </p>

        <div style={card}>
          {/* Dark mode */}
          <div
            onClick={() => setTheme('dark')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderBottom: '1px solid var(--color-border)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#111',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Moon size={18} color="var(--color-accent)" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t.profile.darkMode}</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '2px 0 0' }}>{theme === 'dark' ? t.profile.darkModeActive : ''}</p>
            </div>
            {theme === 'dark' && (
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
            )}
          </div>

          {/* Light mode */}
          <div
            onClick={() => setTheme('light')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#F9F6E8',
                border: '1px solid rgba(0,0,0,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B6914" strokeWidth="2">
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
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t.profile.lightMode}</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '2px 0 0' }}>{theme === 'light' ? t.profile.darkModeActive : ''}</p>
            </div>
            {theme === 'light' && (
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
            )}
          </div>
        </div>
      </div>
    </Panel>
  )
}

// ─── Privacy & Security Panel ─────────────────────────────────────────────────

function PrivacySecurityPanel({ open, onBack, email, t }: { open: boolean; onBack: () => void; email: string; t: Translations }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setCurrentPw(''); setNewPw(''); setConfirmPw('') }
  }, [open])

  const strength = newPw ? passwordStrength(newPw, t) : null

  async function handleChangePassword() {
    if (!currentPw) { toast.error(t.profile.enterCurrentPw); return }
    if (newPw.length < 8) { toast.error(t.profile.pwMin8); return }
    if (newPw !== confirmPw) { toast.error(t.profile.passwordsDontMatch); return }

    setSaving(true)
    const supabase = createClient()

    // Verify current password by re-authenticating
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPw })
    if (signInErr) {
      setSaving(false)
      toast.error(t.profile.pwIncorrect)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSaving(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(t.profile.pwChanged)
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
    <Panel open={open} onBack={onBack} title={t.profile.privacyTitle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Change password */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
            {t.profile.changePassword}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputStyle, paddingRight: 44 }}
                type={showCurrent ? 'text' : 'password'}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder={t.profile.currentPassword}
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
                placeholder={t.profile.newPassword}
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
              placeholder={t.profile.confirmPassword}
              autoComplete="new-password"
            />

            {confirmPw && newPw !== confirmPw && (
              <p style={{ fontSize: 12, color: '#ef4444', margin: '-4px 0 0' }}>{t.profile.passwordsDontMatch}</p>
            )}

            <button
              type="button"
              onClick={handleChangePassword}
              disabled={saving}
              style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? t.profile.changing : t.profile.changePassword}
            </button>
          </div>
        </div>

        {/* Data & Privacy info */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
            {t.profile.dataPrivacy}
          </p>
          <div style={{ ...card, overflow: 'visible' }}>
            {[
              { title: t.profile.dataEncrypted, desc: t.profile.dataEncryptedSub },
              { title: t.profile.privateDefault, desc: t.profile.privateDefaultSub },
              { title: t.profile.noThirdParty, desc: t.profile.noThirdPartySub },
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

function HelpFeedbackPanel({ open, onBack, clientId, workspaceId, coachId, t }: {
  open: boolean
  onBack: () => void
  clientId: string
  workspaceId: string
  coachId: string | null
  t: Translations
}) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!message.trim()) { toast.error(t.profile.writeMessageFirst); return }
    if (!coachId) { toast.error(t.messages.noCoachAssigned); return }
    setSending(true)
    const result = await sendFeedbackToCoach(clientId, workspaceId, coachId, message)
    setSending(false)
    if (result.error) { toast.error(result.error) } else {
      toast.success(t.profile.messageSent)
      setMessage('')
    }
  }

  const FAQS = getFaqs(t)

  return (
    <Panel open={open} onBack={onBack} title={t.profile.helpTitle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* FAQs */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
            {t.profile.faqs}
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
            {t.profile.contactCoach}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.profile.askPlaceholder}
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
              {sending ? t.profile.sending : t.profile.sendToCoach}
            </button>
            {!coachId && (
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', textAlign: 'center', margin: 0 }}>
                {t.profile.noCoachYet}
              </p>
            )}
          </div>
        </div>
      </div>
    </Panel>
  )
}

// ─── Preferences Panel (language) ────────────────────────────────────────────

function PreferencesPanel({ open, onBack, t, lang, setLang }: {
  open: boolean
  onBack: () => void
  t: Translations
  lang: Lang
  setLang: (l: Lang) => void
}) {
  const options: { value: Lang; label: string }[] = [
    { value: 'en', label: t.profile.english },
    { value: 'bg', label: t.profile.bulgarian },
  ]
  return (
    <Panel open={open} onBack={onBack} title={t.profile.preferences}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 2px 2px' }}>
          {t.profile.language}
        </p>
        <div style={card}>
          {options.map((opt, i) => {
            const active = lang === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLang(opt.value)}
                style={{
                  ...rowBase,
                  borderBottom: i === options.length - 1 ? 'none' : '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{opt.label}</p>
                </div>
                {active && (
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    backgroundColor: 'var(--color-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Check size={13} color="#fff" />
                  </div>
                )}
              </button>
            )
          })}
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
  const { t, lang, setLang } = useLanguage()
  const [activePanel, setActivePanel] = useState<Panel>(null)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  // Local state updated after saves
  const [displayName, setDisplayName] = useState(fullName)
  const [displayPhone, setDisplayPhone] = useState(phone)
  const [displayAvatar, setDisplayAvatar] = useState(avatarUrl)

  const initials = displayName.trim().split(' ').map((p) => p[0]?.toUpperCase() ?? '').join('').slice(0, 2) || '?'

  const langSubLabel = lang === 'bg' ? t.profile.bulgarian : t.profile.english

  const MENU_SECTIONS = [
    {
      title: t.profile.account,
      items: [
        { icon: User,   label: t.profile.personalInfo,   sub: t.profile.personalInfoSub, panel: 'personal-info' as Panel },
        { icon: Bell,   label: t.profile.notifications,  sub: t.profile.notificationsSub, panel: 'notifications' as Panel },
        { icon: Moon,   label: t.profile.appearance,     sub: t.profile.appearanceSub,    panel: 'appearance' as Panel },
      ],
    },
    {
      title: t.profile.preferences,
      items: [
        { icon: User,   label: t.profile.language,       sub: langSubLabel,               panel: 'preferences' as Panel },
      ],
    },
    {
      title: t.profile.support,
      items: [
        { icon: Shield,     label: t.profile.privacy,    sub: t.profile.privacySub,       panel: 'privacy-security' as Panel },
        { icon: HelpCircle, label: t.profile.help,       sub: t.profile.helpSub,          panel: 'help-feedback' as Panel },
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
            {t.profile.title}
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
                  {t.profile.week} {weekNumber} {t.profile.of} {totalWeeks}
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
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.3 }}>{t.profile.progress}</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '1px 0 0' }}>{t.profile.progressSub}</p>
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
            onClick={() => setShowSignOutConfirm(true)}
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
            {t.profile.signOut}
          </button>
        </div>
      </div>

      {/* ── Sign out confirmation modal ── */}
      {showSignOutConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowSignOutConfirm(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 20,
              padding: '28px 24px',
              width: '100%', maxWidth: 340,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 52, height: 52, borderRadius: '50%',
                backgroundColor: 'rgba(239,68,68,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <LogOut size={22} color="#ef4444" />
            </div>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {t.profile.signOutQ}
              </p>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                {t.profile.signOutSub}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                style={{
                  flex: 1, padding: '12px 0',
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  fontSize: 15, fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  flex: 1, padding: '12px 0',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 15, fontWeight: 600,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {t.profile.signOut}
              </button>
            </div>
          </div>
        </div>
      )}

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
        t={t}
      />

      <NotificationsPanel
        open={activePanel === 'notifications'}
        onBack={() => setActivePanel(null)}
        userId={userId}
        t={t}
      />

      <AppearancePanel
        open={activePanel === 'appearance'}
        onBack={() => setActivePanel(null)}
        t={t}
      />

      <PreferencesPanel
        open={activePanel === 'preferences'}
        onBack={() => setActivePanel(null)}
        t={t}
        lang={lang}
        setLang={setLang}
      />

      <PrivacySecurityPanel
        open={activePanel === 'privacy-security'}
        onBack={() => setActivePanel(null)}
        email={email}
        t={t}
      />

      <HelpFeedbackPanel
        open={activePanel === 'help-feedback'}
        onBack={() => setActivePanel(null)}
        clientId={clientId}
        workspaceId={workspaceId}
        coachId={coachId}
        t={t}
      />
    </>
  )
}
