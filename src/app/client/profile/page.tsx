'use client'

import { useState } from 'react'
import { LogOut, ChevronRight, Bell, Moon, Shield, HelpCircle, User } from 'lucide-react'

const MENU_SECTIONS = [
  {
    title: 'Account',
    items: [
      { icon: User,       label: 'Personal info',      sub: 'Name, email, phone' },
      { icon: Bell,       label: 'Notifications',      sub: 'Push & email preferences' },
      { icon: Moon,       label: 'Appearance',         sub: 'Dark mode' },
    ],
  },
  {
    title: 'Support',
    items: [
      { icon: Shield,     label: 'Privacy & security', sub: 'Password, data' },
      { icon: HelpCircle, label: 'Help & feedback',    sub: 'FAQs, contact coach' },
    ],
  },
]

export default function ProfilePage() {
  const [initials] = useState('MT')
  const [name]     = useState('Martin T.')
  const [email]    = useState('martin@example.com')
  const [week]     = useState(8)
  const [total]    = useState(12)

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 32 }}>

      {/* ── Header ── */}
      <div style={{ padding: '52px 20px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
          Profile
        </h1>
      </div>

      {/* ── Avatar card ── */}
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
              backgroundColor: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 20,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '0.02em',
            }}
          >
            {initials}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
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
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-accent)',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-accent)' }}>
                Week {week} of {total}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Menu sections ── */}
      {MENU_SECTIONS.map((section) => (
        <div key={section.title} style={{ padding: '0 16px 16px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-hint)', margin: '0 0 8px 2px' }}>
            {section.title}
          </p>
          <div
            style={{
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            {section.items.map((item, idx) => {
              const Icon = item.icon
              const isLast = idx === section.items.length - 1
              return (
                <button
                  key={item.label}
                  type="button"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 16px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
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
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.3 }}>
                      {item.label}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-hint)', margin: '1px 0 0' }}>
                      {item.sub}
                    </p>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* ── Sign out ── */}
      <div style={{ padding: '4px 16px 0' }}>
        <button
          type="button"
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
  )
}
