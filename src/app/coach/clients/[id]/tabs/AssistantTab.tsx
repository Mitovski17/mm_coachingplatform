'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Square, CheckCircle, RefreshCw, History, Plus, Trash2, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { format } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────────────────

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  isMealPlan?: boolean
}

type MealPlanFood = {
  food_name: string
  quantity: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

type MealPlanOption = {
  label: string
  sort_order: number
  foods: MealPlanFood[]
}

type MealPlanMeal = {
  name: string
  sort_order: number
  options: MealPlanOption[]
}

type MealPlanJSON = {
  name: string
  plan_type: 'training' | 'rest'
  notes: string
  recommendations: string
  meals: MealPlanMeal[]
}

type MealPlanCard = {
  clientId: string
  clientName: string
  planName: string
  planType: 'training' | 'rest'
  saving: boolean
  result: 'idle' | 'saved' | { error: string }
}

type SessionSummary = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "Summarize this week's check-in and flag any concerns",
  'How is their training progressing over the last 4 weeks?',
  'Suggest adjustments to their meal plan based on recent data',
  'Draft a personalized check-in response message',
  'What are the main red flags I should address right now?',
  'How is their weight trending compared to their goal?',
]

// ── Markdown renderer ─────────────────────────────────────────────────────────

function MarkdownContent({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <div>
      <ReactMarkdown
        components={{
          p: (props) => <p style={{ margin: '0 0 8px', lineHeight: '1.6' }}>{props.children}</p>,
          ul: (props) => <ul style={{ margin: '4px 0 8px', paddingLeft: 20, listStyleType: 'disc' }}>{props.children}</ul>,
          ol: (props) => <ol style={{ margin: '4px 0 8px', paddingLeft: 20, listStyleType: 'decimal' }}>{props.children}</ol>,
          li: (props) => <li style={{ margin: '2px 0' }}>{props.children}</li>,
          strong: (props) => <strong style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{props.children}</strong>,
          em: (props) => <em style={{ fontStyle: 'italic' }}>{props.children}</em>,
          code: (props) => (
            <code style={{ backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 4, padding: '1px 5px', fontSize: '0.82em', fontFamily: 'monospace' }}>
              {props.children}
            </code>
          ),
          pre: (props) => (
            <pre style={{ backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: '10px 12px', overflowX: 'auto', margin: '6px 0 8px', fontSize: '0.82em', fontFamily: 'monospace' }}>
              {props.children}
            </pre>
          ),
          table: (props) => (
            <div style={{ overflowX: 'auto', margin: '6px 0 8px' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '0.82em', width: '100%' }}>{props.children}</table>
            </div>
          ),
          th: (props) => <th style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', textAlign: 'left', backgroundColor: 'rgba(0,0,0,0.2)', fontWeight: 600 }}>{props.children}</th>,
          td: (props) => <td style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px' }}>{props.children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && (
        <span className="animate-pulse" style={{ display: 'inline-block', color: 'var(--color-text-hint)' }}>
          &#9611;
        </span>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssistantTab({
  clientId,
  workspaceId,
  clientName,
}: {
  clientId: string
  workspaceId: string
  clientName: string
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mealPlanCards, setMealPlanCards] = useState<Record<string, MealPlanCard>>({})

  // History state
  const [showHistory, setShowHistory] = useState(false)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load session list when history panel opens
  useEffect(() => {
    if (!showHistory) return
    setSessionsLoading(true)
    fetch(`/api/assistant/sessions?client_id=${clientId}`)
      .then((r) => r.json())
      .then((d: { sessions?: SessionSummary[] }) => setSessions(d.sessions ?? []))
      .catch(() => {})
      .finally(() => setSessionsLoading(false))
  }, [showHistory, clientId])

  // Auto-save: debounce 1.5s after messages change
  useEffect(() => {
    if (messages.length === 0) return
    const hasFinal = messages.some((m) => !m.streaming && m.content.trim() !== '')
    if (!hasFinal) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveSession(messages)
    }, 1500)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  const saveSession = useCallback(
    async (msgs: Message[]) => {
      const serializable = msgs
        .filter((m) => !m.streaming && m.content.trim() !== '')
        .map(({ role, content }) => ({ role, content }))
      if (serializable.length === 0) return

      const titleMsg = msgs.find((m) => m.role === 'user')?.content ?? 'New conversation'
      const title = titleMsg.length > 60 ? titleMsg.slice(0, 57) + '...' : titleMsg

      if (currentSessionId) {
        await fetch(`/api/assistant/sessions/${currentSessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, messages: serializable }),
        })
      } else {
        const res = await fetch('/api/assistant/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            workspace_id: workspaceId,
            title,
            messages: serializable,
          }),
        })
        if (res.ok) {
          const data = await res.json() as { id?: string }
          if (data.id) setCurrentSessionId(data.id)
        }
      }
    },
    [clientId, workspaceId, currentSessionId]
  )

  const loadSession = async (sessionId: string) => {
    const res = await fetch(`/api/assistant/sessions/${sessionId}`)
    if (!res.ok) return
    const data = await res.json() as { session?: { id: string; messages: { role: 'user' | 'assistant'; content: string }[] } }
    if (!data.session) return

    const loaded: Message[] = data.session.messages.map((m) => ({
      id: crypto.randomUUID(),
      role: m.role,
      content: m.content,
    }))
    setMessages(loaded)
    setMealPlanCards({})
    setCurrentSessionId(sessionId)
    setShowHistory(false)
  }

  const deleteSession = async (sessionId: string) => {
    setDeletingId(sessionId)
    await fetch(`/api/assistant/sessions/${sessionId}`, { method: 'DELETE' })
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    if (currentSessionId === sessionId) {
      setMessages([])
      setCurrentSessionId(null)
    }
    setDeletingId(null)
  }

  const startNewChat = () => {
    setMessages([])
    setMealPlanCards({})
    setCurrentSessionId(null)
    setInput('')
    setShowHistory(false)
  }

  const adjustHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim()
      if (!msg || loading) return

      const controller = new AbortController()
      abortControllerRef.current = controller

      const historyForApi = messages
        .filter((m) => !m.streaming && m.content.trim() !== '')
        .map(({ role, content }) => ({ role, content }))

      const userMsgId = crypto.randomUUID()
      const assistantId = crypto.randomUUID()

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: 'user', content: msg },
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ])
      setInput('')
      setLoading(true)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'

      try {
        const res = await fetch('/api/assistant/client-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...historyForApi, { role: 'user', content: msg }],
            client_id: clientId,
            workspace_id: workspaceId,
          }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

        const isMealPlan = res.headers.get('X-Is-Meal-Plan') === 'true'
        const mealClientId = res.headers.get('X-Client-Id')
        const mealClientName = decodeURIComponent(res.headers.get('X-Client-Name') ?? '')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: accumulated, isMealPlan } : m
            )
          )
        }

        if (isMealPlan && mealClientId) {
          setMealPlanCards((prev) => ({
            ...prev,
            [assistantId]: {
              clientId: mealClientId,
              clientName: mealClientName || clientName,
              planName: `${clientName} Meal Plan`,
              planType: 'training',
              saving: false,
              result: 'idle',
            },
          }))
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // finalize streamed content
        } else {
          const errMsg = err instanceof Error ? err.message : 'Something went wrong'
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: `Error: ${errMsg}` } : m
            )
          )
        }
      } finally {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
        )
        abortControllerRef.current = null
        setLoading(false)
      }
    },
    [input, loading, messages, clientId, workspaceId, clientName]
  )

  const handleSaveCard = useCallback(
    async (messageId: string) => {
      const card = mealPlanCards[messageId]
      if (!card || card.saving || card.result === 'saved') return

      const msgContent = messages.find((m) => m.id === messageId)?.content ?? ''

      setMealPlanCards((prev) => ({
        ...prev,
        [messageId]: { ...prev[messageId], saving: true },
      }))

      try {
        const extractRes = await fetch('/api/assistant/extract-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markdown: msgContent }),
        })

        let plan: MealPlanJSON | null = null
        if (extractRes.ok) {
          const extracted = await extractRes.json() as { plan?: MealPlanJSON }
          plan = extracted.plan ?? null
        }

        if (!plan) {
          plan = {
            name: card.planName,
            plan_type: card.planType,
            notes: '',
            recommendations: '',
            meals: [],
          }
        }

        const saveRes = await fetch('/api/meal-plan/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: card.clientId,
            workspace_id: workspaceId,
            plan: {
              ...plan,
              name: card.planName.trim() || plan.name,
              plan_type: card.planType,
            },
          }),
        })

        if (!saveRes.ok) {
          const data = await saveRes.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error ?? `HTTP ${saveRes.status}`)
        }

        setMealPlanCards((prev) => ({
          ...prev,
          [messageId]: { ...prev[messageId], saving: false, result: 'saved' },
        }))
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Save failed'
        setMealPlanCards((prev) => ({
          ...prev,
          [messageId]: { ...prev[messageId], saving: false, result: { error: errMsg } },
        }))
      }
    },
    [mealPlanCards, messages, workspaceId]
  )

  const handleStop = () => abortControllerRef.current?.abort()

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const canSend = input.trim().length > 0 && !loading

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 280px)', minHeight: 500, position: 'relative' }}>
      {/* Toolbar row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {messages.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>
              {currentSessionId ? 'Auto-saved' : 'Unsaved'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {messages.length > 0 && (
            <button
              onClick={startNewChat}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', fontSize: 12, fontWeight: 500,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              New chat
            </button>
          )}
          <button
            onClick={() => setShowHistory((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', fontSize: 12, fontWeight: 500,
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${showHistory ? 'var(--color-accent)' : 'var(--color-border)'}`,
              backgroundColor: showHistory ? 'rgba(99,102,241,0.1)' : 'transparent',
              color: showHistory ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <History size={13} />
            History
          </button>
        </div>
      </div>

      {/* Main area: history panel + chat */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>

        {/* History panel */}
        {showHistory && (
          <div
            style={{
              width: 260,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            {/* Panel header */}
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Chat history
              </span>
              <button
                onClick={() => setShowHistory(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', display: 'flex', alignItems: 'center' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* New chat button */}
            <button
              onClick={startNewChat}
              style={{
                margin: '8px 10px 4px',
                padding: '7px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--color-border)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Plus size={12} />
              New conversation
            </button>

            {/* Session list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px 10px' }}>
              {sessionsLoading ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12, color: 'var(--color-text-hint)' }}>
                  Loading…
                </div>
              ) : sessions.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12, color: 'var(--color-text-hint)' }}>
                  No past conversations yet
                </div>
              ) : (
                sessions.map((session) => {
                  const isActive = session.id === currentSessionId
                  return (
                    <div
                      key={session.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                        marginBottom: 2,
                      }}
                    >
                      <button
                        onClick={() => loadSession(session.id)}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          padding: '8px 10px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginBottom: 2,
                          }}
                        >
                          {session.title}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-hint)' }}>
                          {format(new Date(session.updated_at), 'MMM d, HH:mm')}
                        </div>
                      </button>
                      <button
                        onClick={() => deleteSession(session.id)}
                        disabled={deletingId === session.id}
                        style={{
                          flexShrink: 0,
                          padding: '4px 6px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-text-hint)',
                          display: 'flex',
                          alignItems: 'center',
                          opacity: deletingId === session.id ? 0.4 : 1,
                        }}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Chat panel */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--color-surface-2)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
          }}
        >
          {/* Message list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {messages.length === 0 ? (
              <div
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: '100%', gap: 24,
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: '50%',
                      backgroundColor: 'rgba(99,102,241,0.15)',
                      border: '1px solid rgba(99,102,241,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 12px', fontSize: 20,
                    }}
                  >
                    ✦
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                    AI Assistant for {clientName}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-hint)' }}>
                    Ask anything about this client — check-ins, training, nutrition, or meal plan ideas.
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 8, width: '100%', maxWidth: 600,
                  }}
                >
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      disabled={loading}
                      style={{
                        textAlign: 'left', padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface-1)',
                        color: 'var(--color-text-secondary)',
                        fontSize: 12, lineHeight: 1.4, cursor: 'pointer',
                        transition: 'border-color 0.15s, background-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent)'
                        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'
                        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)'
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {messages.map((msg) => {
                  const card = mealPlanCards[msg.id]
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div
                          style={{
                            maxWidth: '80%', padding: '10px 14px',
                            borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                            backgroundColor: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-surface-3)',
                            color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
                            fontSize: '0.875rem', lineHeight: '1.6', wordBreak: 'break-word',
                          }}
                        >
                          {msg.role === 'user' ? (
                            <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                          ) : (
                            <MarkdownContent content={msg.content || ''} streaming={msg.streaming} />
                          )}
                        </div>
                      </div>

                      {/* Meal plan save card */}
                      {card && !msg.streaming && (
                        <div
                          style={{
                            maxWidth: 420, borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-surface-1)',
                            padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
                          }}
                        >
                          {card.result === 'saved' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#22c55e', fontSize: '0.875rem', fontWeight: 500 }}>
                              <CheckCircle size={18} />
                              Saved and assigned to {card.clientName}
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-hint)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Meal Plan Ready
                                </span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                  Save this plan to {card.clientName}&apos;s profile
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Plan name</label>
                                <input
                                  type="text"
                                  value={card.planName}
                                  onChange={(e) => setMealPlanCards((prev) => ({ ...prev, [msg.id]: { ...prev[msg.id], planName: e.target.value } }))}
                                  style={{
                                    backgroundColor: 'var(--color-surface-3)', border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)', padding: '7px 10px',
                                    color: 'var(--color-text-primary)', fontSize: '0.875rem', outline: 'none',
                                  }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Plan type</label>
                                <select
                                  value={card.planType}
                                  onChange={(e) => setMealPlanCards((prev) => ({ ...prev, [msg.id]: { ...prev[msg.id], planType: e.target.value as 'training' | 'rest' } }))}
                                  style={{
                                    backgroundColor: 'var(--color-surface-3)', border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)', padding: '7px 10px',
                                    color: 'var(--color-text-primary)', fontSize: '0.875rem', outline: 'none', cursor: 'pointer',
                                  }}
                                >
                                  <option value="training">Training day</option>
                                  <option value="rest">Rest day</option>
                                </select>
                              </div>
                              {typeof card.result === 'object' && (
                                <div style={{ fontSize: '0.8rem', color: '#f87171' }}>{card.result.error}</div>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSaveCard(msg.id)}
                                disabled={card.saving}
                                style={{
                                  alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7,
                                  padding: '9px 18px', borderRadius: 'var(--radius-md)', border: 'none',
                                  backgroundColor: card.saving ? 'var(--color-surface-3)' : 'var(--color-accent)',
                                  color: card.saving ? 'var(--color-text-hint)' : '#fff',
                                  fontSize: '0.875rem', fontWeight: 600,
                                  cursor: card.saving ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {card.saving ? (
                                  <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />Saving...</>
                                ) : 'Save & Assign'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input bar */}
          <div
            style={{
              flexShrink: 0, borderTop: '1px solid var(--color-border)',
              padding: '12px 16px', display: 'flex', gap: 10,
              alignItems: 'flex-end', backgroundColor: 'var(--color-surface-1)',
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); adjustHeight() }}
              onKeyDown={handleKeyDown}
              placeholder={`Ask anything about ${clientName}...`}
              rows={1}
              style={{
                flex: 1, resize: 'none',
                backgroundColor: 'var(--color-surface-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'var(--color-text-primary)',
                fontSize: '0.875rem', lineHeight: '1.5', outline: 'none',
                overflowY: 'hidden', minHeight: '42px', maxHeight: '200px',
              }}
            />
            {loading ? (
              <button
                type="button"
                onClick={handleStop}
                style={{
                  width: 38, height: 38, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                }}
              >
                <Square size={14} fill="#ef4444" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={!canSend}
                style={{
                  width: 38, height: 38, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: canSend ? 'var(--color-accent)' : 'var(--color-surface-3)',
                  color: canSend ? '#fff' : 'var(--color-text-hint)',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  cursor: canSend ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.15s, color 0.15s',
                }}
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
