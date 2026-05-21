'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import MessageBubble from '@/components/shared/MessageBubble'
import MessageInput from '@/components/shared/MessageInput'
import { sendMessage, markMessagesRead, type Message } from './actions'

type Props = {
  conversationId: string
  clientName: string
  initialMessages: Message[]
}

export default function ThreadClient({ conversationId, clientName, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const seenIds = useRef(new Set(initialMessages.map((m) => m.id)))

  // Auto-scroll when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`coach-thread-${conversationId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const msg = payload.new as Message
          if (seenIds.current.has(msg.id)) return
          seenIds.current.add(msg.id)
          setMessages((prev) => [...prev, msg])
          // Mark as read if the client sent it
          if (msg.sender_role === 'client') {
            void markMessagesRead(conversationId, 'coach')
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId])

  const handleSend = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || sending) return

    setSending(true)
    setInputValue('')
    try {
      const msg = await sendMessage(conversationId, trimmed, 'coach')
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--color-base)',
      }}
    >
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
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2 }}>
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
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-hint)', fontSize: 13, marginTop: 40 }}>
            No messages yet. Start the conversation!
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            body={msg.body}
            sentAt={msg.created_at}
            isMine={msg.sender_role === 'coach'}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
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
