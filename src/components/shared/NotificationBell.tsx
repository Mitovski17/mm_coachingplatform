'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/types/supabase'

type Props = {
  recipientType: 'coach' | 'client'
  recipientId: string
}

export default function NotificationBell({ recipientType, recipientId }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const unreadCount = notifications.filter((n) => !n.read).length

  const loadNotifications = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_type', recipientType)
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications((data as Notification[]) ?? [])
    setLoading(false)
  }, [recipientType, recipientId])

  useEffect(() => {
    void loadNotifications()

    const supabase = createClient()
    const channelName = `notifications-${recipientType}-${recipientId}-${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${recipientId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const notif = payload.new as Notification
          setNotifications((prev) => [notif, ...prev].slice(0, 20))
          toast(notif.title, {
            description: notif.body || undefined,
            action: notif.link
              ? { label: 'View', onClick: () => router.push(notif.link) }
              : undefined,
          })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [recipientType, recipientId, loadNotifications])

  // Close on click-outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Reposition on scroll / resize while open
  useEffect(() => {
    if (!open) return
    function reposition() {
      if (!buttonRef.current) return
      const rect = buttonRef.current.getBoundingClientRect()
      const panelWidth = 340
      const margin = 8
      const vw = window.innerWidth

      if (vw <= 480) {
        // mobile: handled purely by CSS
        setPanelPos(null)
        return
      }

      // Prefer aligning left edge of panel to left edge of button,
      // but clamp so the panel never leaves the viewport.
      let left = rect.left
      if (left + panelWidth + margin > vw) {
        left = vw - panelWidth - margin
      }
      if (left < margin) left = margin

      setPanelPos({ top: rect.bottom + 8, left })
    }
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  function handleOpen() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const panelWidth = 340
      const margin = 8
      const vw = window.innerWidth

      if (vw > 480) {
        let left = rect.left
        if (left + panelWidth + margin > vw) left = vw - panelWidth - margin
        if (left < margin) left = margin
        setPanelPos({ top: rect.bottom + 8, left })
      } else {
        setPanelPos(null)
      }
    }
    setOpen((o) => !o)
  }

  async function markRead(id: string) {
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function handleRowClick(notif: Notification) {
    void markRead(notif.id)
    setOpen(false)
    router.push(notif.link)
  }

  return (
    <>
      <style>{`
        .notif-bell-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid var(--color-border);
          cursor: pointer;
          background-color: var(--color-surface-2);
          color: var(--color-text-primary);
          transition: background-color 0.15s, border-color 0.15s;
          flex-shrink: 0;
        }
        .notif-bell-btn:hover {
          background-color: var(--color-surface-3);
          border-color: var(--color-accent);
        }
        .notif-bell-btn.open {
          background-color: var(--color-surface-3);
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        /* Desktop panel — positioned via inline style from JS */
        .notif-panel {
          position: fixed;
          width: 340px;
          max-height: 460px;
          background-color: var(--color-surface-1);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.6);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Mobile: fixed full-width from top */
        @media (max-width: 480px) {
          .notif-panel {
            top: 60px !important;
            left: 8px !important;
            right: 8px;
            width: auto;
            max-height: calc(100dvh - 80px);
            border-radius: 14px;
          }
        }

        .notif-backdrop {
          display: none;
        }
        @media (max-width: 480px) {
          .notif-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.45);
            z-index: 9998;
          }
        }

        .notif-row {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 16px;
          background: none;
          border: none;
          border-bottom: 1px solid var(--color-border);
          cursor: pointer;
          text-align: left;
          transition: background-color 0.1s;
        }
        .notif-row:hover {
          background-color: var(--color-surface-2);
        }
        @media (max-width: 480px) {
          .notif-row {
            padding: 14px 16px;
            min-height: 56px;
          }
        }
      `}</style>

      {/* Wrapper only needs relative for badge, not for panel positioning */}
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          ref={buttonRef}
          suppressHydrationWarning
          type="button"
          onClick={handleOpen}
          aria-label="Notifications"
          className={`notif-bell-btn${open ? ' open' : ''}`}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -5,
                right: -5,
                minWidth: 18,
                height: 18,
                borderRadius: '9999px',
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                lineHeight: 1,
                boxShadow: '0 0 0 2px var(--color-surface-1)',
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Panel rendered outside overflow:hidden ancestors via fixed positioning */}
      {open && (
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className="notif-panel"
            style={panelPos ? { top: panelPos.top, left: panelPos.left } : {}}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border)',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Notifications
                {unreadCount > 0 && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      backgroundColor: '#ef4444',
                      color: '#fff',
                      borderRadius: '9999px',
                      padding: '1px 6px',
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {unreadCount > 0 && (
                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={markAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: 'var(--color-accent)',
                      fontWeight: 500,
                      padding: 0,
                    }}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  suppressHydrationWarning
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close notifications"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    color: 'var(--color-text-muted)',
                    padding: '0 2px',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading ? (
                <div
                  style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: 'var(--color-text-hint)',
                    fontSize: 13,
                  }}
                >
                  Loading…
                </div>
              ) : notifications.length === 0 ? (
                <div
                  style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    color: 'var(--color-text-hint)',
                    fontSize: 13,
                  }}
                >
                  No notifications yet
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    suppressHydrationWarning
                    key={notif.id}
                    type="button"
                    onClick={() => handleRowClick(notif)}
                    className="notif-row"
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: notif.read ? 'transparent' : 'var(--color-accent)',
                        flexShrink: 0,
                        marginTop: 5,
                        border: notif.read ? '1.5px solid var(--color-border)' : 'none',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: notif.read ? 400 : 600,
                          color: 'var(--color-text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {notif.title}
                      </div>
                      {notif.body && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--color-text-hint)',
                            marginTop: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {notif.body}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--color-text-hint)', marginTop: 4 }}>
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
