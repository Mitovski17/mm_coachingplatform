'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import MessageBubble from '@/components/shared/MessageBubble'
import MessageInput from '@/components/shared/MessageInput'
import { sendMessage, markMessagesRead, type Message } from './actions'

type Props = {
  conversationId: string
  coachName: string
  initialMessages: Message[]
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
    const isMine = msg.sender_role === 'client'

    items.push({ kind: 'message', msg, isFirst, isLast, showAvatar: !isMine && isLast, key: msg.id })
  }
  return items
}

export default function ThreadClient({ conversationId, coachName, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const seenIds = useRef(new Set(initialMessages.map((m) => m.id)))
  const coachInitials = getInitials(coachName)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!conversationId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`client-thread-${conversationId}`)
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
          if (msg.sender_role === 'coach') void markMessagesRead(conversationId)
        }
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [conversationId])

  const handleSend = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || sending || !conversationId) return
    setSending(true)
    setInputValue('')
    try {
      const msg = await sendMessage(conversationId, trimmed)
      if (!seenIds.current.has(msg.id)) {
        seenIds.current.add(msg.id)
        setMessages((prev) => [...prev, msg])
      }
    } catch (err) {
      console.error('Failed to send message', err)
      setInputValue(trimmed)
    } finally {
      setSending(false)
    }
  }

  const renderItems = buildRenderItems(messages)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 68px)', backgroundColor: 'var(--color-base)' }}>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 20px',
          height: 60,
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface-1)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: '#f97316',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {coachInitials}
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2 }}>
            {coachName}
          </p>
          <p style={{ fontSize: 11, color: 'var(--color-text-hint)', margin: 0 }}>Your coach</p>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-hint)', fontSize: 13, marginTop: 40 }}>
            No messages yet. Say hi to your coach!
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
              isMine={item.msg.sender_role === 'client'}
              isFirst={item.isFirst}
              isLast={item.isLast}
              showAvatar={item.showAvatar}
              avatarInitials={coachInitials}
            />
          )
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        sending={sending}
        placeholder={`Message ${coachName}…`}
      />
    </div>
  )
}
