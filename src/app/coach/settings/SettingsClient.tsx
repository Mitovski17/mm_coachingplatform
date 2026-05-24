'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  LogOut, Bell, Moon, Shield, User, Camera, Eye, EyeOff, Check,
  ChevronDown, ChevronUp, Globe,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateCoachProfile, uploadCoachAvatar, signOut } from './actions'
import { toast } from 'sonner'
import type { CoachClientRow } from './page'

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveSection = 'personal-info' | 'security' | null

type NotifPrefs = {
  emailEnabled: boolean
  newClientAlerts: boolean
  checkinAlerts: boolean
  messageAlerts: boolean
}

type Props = {
  userId: string
  email: string
  profileId: string
  fullName: string
  avatarUrl: string | null
  role: string
  workspaceName: string
  workspacePlan: string
  clients: CoachClientRow[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  lose_fat: 'Fat loss',
  build_muscle: 'Hypertrophy',
  recomposition: 'Recomp',
  performance: 'Performance',
  strength: 'Strength',
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  inactive: '#f59e0b',
  archived: '#6b7280',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  coach: 'Coach',
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

const DEFAULT_NOTIF: NotifPrefs = {
  emailEnabled: true,
  newClientAlerts: true,
  checkinAlerts: true,
  messageAlerts: true,
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: 'var(--color-surface-1)',
  border: '1px solid var(--color-border)',
  borderRadius: 14,
  overflow: 'hidden',
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
  padding: '11px 22px',
  backgroundColor: 'var(--color-accent)',
  border: 'none',
  borderRadius: 10,
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

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

// ─── Toggle ───────────────────────────────────────────────────────────────────

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

// ─── Section row (accordion header) ──────────────────────────────────────────

function SectionRow({
  icon: Icon, label, sub, open, onToggle, isLast = false,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  label: string
  sub: string
  open: boolean
  onToggle: () => void
  isLast?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: isLast && !open ? 'none' : '1px solid var(--color-border)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: 'var(--color-surface-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <Icon size={17} style={{ color: 'var(--color-text-secondary)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.3 }}>
          {label}
        </p>
        <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '1px 0 0' }}>{sub}</p>
      </div>
      {open
        ? <ChevronUp size={16} style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />
        : <ChevronDown size={16} style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />}
    </button>
  )
}

// ─── Personal Info form ───────────────────────────────────────────────────────

function PersonalInfoContent({
  profileId, fullName, email, avatarUrl, onSaved,
}: {
  profileId: string
  fullName: string
  email: string
  avatarUrl: string | null
  onSaved: (name: string, avatarUrl: string | null) => void
}) {
  const [name, setName] = useState(fullName)
  const [avatar, setAvatar] = useState<string | null>(avatarUrl)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const initials = getInitials(name || 'Coach')

  useEffect(() => {
    setName(fullName)
    setAvatar(avatarUrl)
  }, [fullName, avatarUrl])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setAvatar(ev.target?.result as string)
    reader.readAsDataURL(file)
    setUploading(true)
    const fd = new FormData()
    fd.append('avatar', file)
    const result = await uploadCoachAvatar(fd)
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
    const result = await updateCoachProfile(profileId, name)
    setSaving(false)
    if (result.error) { toast.error(result.error); return }
    toast.success('Profile saved')
    onSaved(name.trim(), avatar)
  }

  return (
    <div
      style={{
        padding: '20px 16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        backgroundColor: 'var(--color-surface-2)',
      }}
    >
      {/* Avatar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            style={{
              width: 72, height: 72, borderRadius: '50%',
              backgroundColor: avatar ? 'transparent' : 'var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: '#fff', overflow: 'hidden',
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
              position: 'absolute', bottom: 0, right: 0,
              width: 24, height: 24, borderRadius: '50%',
              backgroundColor: 'var(--color-accent)',
              border: '2px solid var(--color-base)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            <Camera size={11} color="#fff" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 2px' }}>
            Profile photo
          </p>
          <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: 0 }}>
            {uploading ? 'Uploading…' : 'Click the camera icon to change'}
          </p>
        </div>
      </div>

      {/* Name field */}
      <div>
        <label
          style={{
            fontSize: 12, fontWeight: 600, color: 'var(--color-text-hint)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            display: 'block', marginBottom: 6,
          }}
        >
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

      {/* Email (read-only) */}
      <div>
        <label
          style={{
            fontSize: 12, fontWeight: 600, color: 'var(--color-text-hint)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            display: 'block', marginBottom: 6,
          }}
        >
          Email
        </label>
        <input
          style={{ ...inputStyle, color: 'var(--color-text-hint)', cursor: 'not-allowed' }}
          value={email}
          readOnly
          title="Email is managed via Supabase Auth"
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ─── Security form ────────────────────────────────────────────────────────────

function SecurityContent({ email }: { email: string }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const strength = newPw ? passwordStrength(newPw) : null

  async function handleChangePassword() {
    if (!currentPw) { toast.error('Enter your current password'); return }
    if (newPw.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return }
    setSaving(true)
    const supabase = createClient()
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPw })
    if (signInErr) { setSaving(false); toast.error('Current password is incorrect'); return }
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
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
    color: 'var(--color-text-hint)', display: 'flex', alignItems: 'center',
  }

  return (
    <div
      style={{
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        backgroundColor: 'var(--color-surface-2)',
      }}
    >
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

      {newPw && strength && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              flex: 1, height: 4, borderRadius: 2,
              backgroundColor: 'var(--color-surface-3)', overflow: 'hidden',
            }}
          >
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
          <span style={{ fontSize: 11, fontWeight: 600, color: strength.color, flexShrink: 0 }}>
            {strength.label}
          </span>
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
        <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>Passwords do not match</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
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
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsClient({
  userId, email, profileId, fullName, avatarUrl, role,
  workspaceName, workspacePlan, clients,
}: Props) {
  const [openSection, setOpenSection] = useState<ActiveSection>(null)
  const [displayName, setDisplayName] = useState(fullName)
  const [displayAvatar, setDisplayAvatar] = useState(avatarUrl)

  const notifKey = `coach_notif_prefs_${userId}`
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(notifKey)
      if (raw) setNotifPrefs({ ...DEFAULT_NOTIF, ...JSON.parse(raw) })
    } catch { /* ignore */ }
  }, [notifKey])

  function updateNotif(patch: Partial<NotifPrefs>) {
    setNotifPrefs((prev) => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(notifKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function toggleSection(s: ActiveSection) {
    setOpenSection((prev) => (prev === s ? null : s))
  }

  const initials = getInitials(displayName || 'Coach')

  const NOTIF_ROWS: { key: keyof NotifPrefs; label: string; sub: string }[] = [
    { key: 'emailEnabled', label: 'Email notifications', sub: 'Updates sent to your inbox' },
    { key: 'newClientAlerts', label: 'New client alerts', sub: 'When a client joins your workspace' },
    { key: 'checkinAlerts', label: 'Check-in submissions', sub: 'When a client submits their weekly check-in' },
    { key: 'messageAlerts', label: 'Client messages', sub: 'New messages from clients' },
  ]

  return (
    <div style={{ padding: '40px', maxWidth: 760, margin: '0 auto' }}>

      {/* Page title */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
          Profile &amp; Settings
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-hint)', margin: 0 }}>
          Manage your account and coaching preferences
        </p>
      </div>

      {/* ── Identity card ── */}
      <div
        style={{
          ...card,
          padding: '20px',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div
          style={{
            width: 64, height: 64, borderRadius: '50%',
            backgroundColor: displayAvatar ? 'transparent' : 'var(--color-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, color: '#fff',
            flexShrink: 0, overflow: 'hidden',
          }}
        >
          {displayAvatar
            ? <img src={displayAvatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)',
              margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {displayName}
          </p>
          <p
            style={{
              fontSize: 13, color: 'var(--color-text-hint)',
              margin: '0 0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {email}
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 999,
                backgroundColor: 'var(--color-accent-dim)',
                fontSize: 11, fontWeight: 600, color: 'var(--color-accent)',
              }}
            >
              {ROLE_LABELS[role] ?? 'Coach'}
            </span>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 999,
                backgroundColor: 'var(--color-surface-3)',
                fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
              }}
            >
              <Globe size={10} /> {workspaceName}
            </span>
            {workspacePlan !== 'free' && (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 999,
                  backgroundColor: 'rgba(245,158,11,0.12)',
                  fontSize: 11, fontWeight: 600, color: '#f59e0b',
                }}
              >
                {PLAN_LABELS[workspacePlan] ?? workspacePlan}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── My Clients ── */}
      {clients.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p
              style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: 0,
              }}
            >
              My Clients ({clients.length})
            </p>
            <Link
              href="/coach/dashboard"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}
            >
              View all →
            </Link>
          </div>
          <div style={card}>
            {clients.map((c, i) => {
              const isLast = i === clients.length - 1
              const statusColor = STATUS_COLORS[c.status ?? ''] ?? '#6b7280'
              return (
                <Link
                  key={c.id}
                  href={`/coach/clients/${c.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                    textDecoration: 'none',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <div
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      backgroundColor: statusColor, flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)',
                        margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {c.full_name}
                    </p>
                    <p
                      style={{
                        fontSize: 12, color: 'var(--color-text-hint)',
                        margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {c.email}
                    </p>
                  </div>
                  {c.goal && (
                    <span
                      style={{
                        padding: '2px 8px', borderRadius: 999,
                        backgroundColor: 'var(--color-surface-3)',
                        fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
                        flexShrink: 0, whiteSpace: 'nowrap',
                      }}
                    >
                      {GOAL_LABELS[c.goal] ?? c.goal}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Account section ── */}
      <div style={{ marginBottom: 28 }}>
        <p
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px',
          }}
        >
          Account
        </p>
        <div style={card}>

          {/* Personal Info (accordion) */}
          <SectionRow
            icon={User}
            label="Personal info"
            sub="Name, profile photo"
            open={openSection === 'personal-info'}
            onToggle={() => toggleSection('personal-info')}
          />
          {openSection === 'personal-info' && (
            <PersonalInfoContent
              profileId={profileId}
              fullName={displayName}
              email={email}
              avatarUrl={displayAvatar}
              onSaved={(name, av) => { setDisplayName(name); setDisplayAvatar(av) }}
            />
          )}

          {/* Notifications (inline toggles) */}
          <div style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: 'var(--color-surface-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <Bell size={17} style={{ color: 'var(--color-text-secondary)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                  Notifications
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '1px 0 0' }}>
                  Alert preferences
                </p>
              </div>
            </div>
            <div style={{ padding: '4px 16px 4px' }}>
              {NOTIF_ROWS.map(({ key, label, sub }, i) => (
                <div
                  key={key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 0',
                    borderBottom: i < NOTIF_ROWS.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                      {label}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '1px 0 0' }}>{sub}</p>
                  </div>
                  <Toggle checked={notifPrefs[key]} onChange={(v) => updateNotif({ [key]: v })} />
                </div>
              ))}
            </div>
          </div>

          {/* Appearance (static) */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: 'var(--color-surface-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <Moon size={17} style={{ color: 'var(--color-text-secondary)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                Appearance
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '1px 0 0' }}>
                Light mode coming soon
              </p>
            </div>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 8,
                backgroundColor: 'var(--color-surface-3)',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Dark</span>
              <Check size={12} color="var(--color-accent)" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Security section ── */}
      <div style={{ marginBottom: 28 }}>
        <p
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px',
          }}
        >
          Security
        </p>
        <div style={card}>
          <SectionRow
            icon={Shield}
            label="Privacy &amp; security"
            sub="Change password, data privacy"
            open={openSection === 'security'}
            onToggle={() => toggleSection('security')}
            isLast
          />
          {openSection === 'security' && <SecurityContent email={email} />}
        </div>
      </div>

      {/* ── Sign out ── */}
      <form action={signOut}>
        <button
          type="submit"
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px',
            backgroundColor: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 14,
            cursor: 'pointer',
            fontSize: 15, fontWeight: 600, color: '#ef4444',
          }}
        >
          <LogOut size={17} />
          Sign out
        </button>
      </form>
    </div>
  )
}
