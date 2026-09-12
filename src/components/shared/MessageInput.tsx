'use client'

import { useRef } from 'react'
import { Send } from 'lucide-react'

type Props = {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  sending: boolean
  placeholder?: string
}

export default function MessageInput({ value, onChange, onSend, sending, placeholder }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!sending && value.trim()) onSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 112) + 'px'
    }
  }

  const isEmpty = !value.trim()

  return (
    <div
      className="cx-chrome"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 10,
        padding: '10px 14px',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      {/* `cx-field` owns the focus border and ring. The old onFocus/onBlur
          handlers wrote an inline border colour, which then outranked every
          stylesheet rule for the life of the element. */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Type a message…'}
        rows={1}
        className="cx-field"
        style={{
          flex: 1,
          resize: 'none',
          border: '1px solid var(--color-border)',
          borderRadius: 20,
          padding: '8px 14px',
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--color-text-primary)',
          backgroundColor: 'var(--color-surface-2)',
          outline: 'none',
          fontFamily: 'inherit',
          overflowY: 'hidden',
        }}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={sending || isEmpty}
        aria-label="Send message"
        className="cx-press"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: sending || isEmpty ? 'var(--color-surface-3)' : 'var(--color-accent)',
          color: sending || isEmpty ? 'var(--color-text-hint)' : '#ffffff',
          boxShadow: sending || isEmpty ? 'none' : 'var(--cx-shadow-cta)',
          border: 'none',
          cursor: sending || isEmpty ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Send size={15} />
      </button>
    </div>
  )
}
