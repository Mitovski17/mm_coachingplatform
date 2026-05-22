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

export default function ThreadClient({ conversationId, coachName, initialMessages }: Props) {
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
    if (!conversationId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`client-thread-${conversationId}`)
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
          // Mark as read if the coach sent it
          if (msg.sender_role === 'coach') {
            void markMessagesRead(conversationId)
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 68px)',
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
          height: 60,
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface-1)',
          flexShrink: 0,
        }}
      >
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2 }}>
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
          padding: '20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-hint)', fontSize: 13, marginTop: 40 }}>
            No messages yet. Say hi to your coach!
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            body={msg.body}
            sentAt={msg.created_at}
            isMine={msg.sender_role === 'client'}
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
        placeholder={`Message ${coachName}…`}
      />
    </div>
  )
}
