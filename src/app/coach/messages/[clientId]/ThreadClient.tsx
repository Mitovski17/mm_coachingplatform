'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import MessageBubble from '@/components/shared/MessageBubble'
import MessageInput from '@/components/shared/MessageInput'
import { sendMessage, markMessagesRead, type Message, type CheckinSnippet } from './actions'

type Props = {
  conversationId: string
  clientName: string
  initialMessages: Message[]
  initialCheckinSnippet?: CheckinSnippet | null
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function getDateLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

type RenderItem =
  | { kind: 'separator'; label: string; key: string }
  | { kind: 'message'; msg: Message; isFirst: boolean; isLast: boolean; showAvatar: boolean; key: string }

function buildRenderItems(messages: Message[]): RenderItem[] {
  const items: RenderItem[] = []
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const prev = messages[i - 1]
    const next = messages[i + 1]

    if (!prev || !isSameDay(prev.created_at, msg.created_at)) {
      items.push({ kind: 'separator', label: getDateLabel(msg.created_at), key: `sep-${msg.id}` })
    }

    const isFirst = !prev || prev.sender_role !== msg.sender_role || !isSameDay(prev.created_at, msg.created_at)
    const isLast = !next || next.sender_role !== msg.sender_role || !isSameDay(msg.created_at, next.created_at)
    const isMine = msg.sender_role === 'coach'

    items.push({ kind: 'message', msg, isFirst, isLast, showAvatar: !isMine && isLast, key: msg.id })
  }
  return items
}

const snippetPillStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  padding: '2px 6px',
  borderRadius: 4,
  backgroundColor: 'var(--color-surface-3)',
  color: 'var(--color-text-secondary)',
}

export default function ThreadClient({ conversationId, clientName, initialMessages, initialCheckinSnippet }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingSnippet, setPendingSnippet] = useState<CheckinSnippet | null>(initialCheckinSnippet ?? null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const seenIds = useRef(new Set(initialMessages.map((m) => m.id)))
  const clientInitials = getInitials(clientName)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`coach-thread-${conversationId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const msg = payload.new as Message
          if (seenIds.current.has(msg.id)) return
          seenIds.current.add(msg.id)
          setMessages((prev) => [...prev, msg])
          if (msg.sender_role === 'client') void markMessagesRead(conversationId, 'coach')
        }
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [conversationId])

  const handleSend = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || sending) return
    setSending(true)
    setInputValue('')
    const snippetToAttach = pendingSnippet
    setPendingSnippet(null)
    try {
      const msg = await sendMessage(conversationId, trimmed, 'coach', snippetToAttach)
      if (!seenIds.current.has(msg.id)) {
        seenIds.current.add(msg.id)
        setMessages((prev) => [...prev, msg])
      }
    } catch (err) {
      console.error('Failed to send message', err)
      setInputValue(trimmed)
      setPendingSnippet(snippetToAttach)
    } finally {
      setSending(false)
    }
  }

  const renderItems = buildRenderItems(messages)

  return (
    <div className="coach-full-height" style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-base)' }}>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 20px',
          height: 64,
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface-1)',
          flexShrink: 0,
        }}
      >
        <Link
          href="/coach/messages"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            color: 'var(--color-text-muted)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            backgroundColor: '#f97316',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {clientInitials}
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2 }}>
            {clientName}
          </p>
          <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: 0 }}>Client</p>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-hint)', fontSize: 13, marginTop: 40 }}>
            No messages yet. Start the conversation!
          </p>
        )}

        {renderItems.map((item) =>
          item.kind === 'separator' ? (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: '10px 0 6px',
              }}
            >
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--color-border)' }} />
              <span style={{ fontSize: 11, color: 'var(--color-text-hint)', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--color-border)' }} />
            </div>
          ) : (
            <MessageBubble
              key={item.key}
              body={item.msg.body}
              sentAt={item.msg.created_at}
              isMine={item.msg.sender_role === 'coach'}
              isFirst={item.isFirst}
              isLast={item.isLast}
              showAvatar={item.showAvatar}
              avatarInitials={clientInitials}
              checkinAttachment={item.msg.checkin_attachment}
            />
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Check-in snippet preview */}
      {pendingSnippet && (
        <div
          style={{
            margin: '0 12px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-2)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-hint)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>📋</span>
              <span>Replying to check-in · {format(new Date(pendingSnippet.submittedAt), 'MMM d')}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {pendingSnippet.metrics.performance !== null && (
                <span style={snippetPillStyle}>Perf {pendingSnippet.metrics.performance}/10</span>
              )}
              {pendingSnippet.metrics.nutrition !== null && (
                <span style={snippetPillStyle}>Nutrition {pendingSnippet.metrics.nutrition}%</span>
              )}
              {pendingSnippet.metrics.training !== null && (
                <span style={snippetPillStyle}>Training {pendingSnippet.metrics.training}%</span>
              )}
              {pendingSnippet.metrics.sleep !== null && (
                <span style={snippetPillStyle}>Sleep {pendingSnippet.metrics.sleep}/10</span>
              )}
              {pendingSnippet.metrics.weight !== null && (
                <span style={snippetPillStyle}>Weight {pendingSnippet.metrics.weight}kg</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPendingSnippet(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', padding: 2, lineHeight: 1, flexShrink: 0 }}
            aria-label="Remove check-in attachment"
          >
            ✕
          </button>
        </div>
      )}

      <MessageInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        sending={sending}
        placeholder={`Message ${clientName}…`}
      />
    </div>
  )
}
