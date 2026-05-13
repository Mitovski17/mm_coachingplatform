'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Save, RefreshCw, CheckCircle, Plus, MessageSquare } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

// ── Types ────────────────────────────────────────────────────────────────────

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

type StoredMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type StoredConversation = {
  id: string
  title: string
  createdAt: number
  messages: StoredMessage[]
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

type MealPlanDraft = {
  plan: MealPlanJSON
  clientId: string
  clientName: string
  messageId: string
}

// ── Constants & helpers ───────────────────────────────────────────────────────

const STORAGE_KEY = 'coach_assistant_conversations'

function loadFromStorage(): StoredConversation[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    return raw ? (JSON.parse(raw) as StoredConversation[]) : []
  } catch {
    return []
  }
}

function saveToStorage(conversations: StoredConversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
  } catch { /* storage quota or SSR */ }
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  return new Date(ts).toLocaleDateString()
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssistantChat({ workspaceId }: { workspaceId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mealPlanDraft, setMealPlanDraft] = useState<MealPlanDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [planNameInput, setPlanNameInput] = useState('')
  const [saveResult, setSaveResult] = useState<{ success: true } | { success: false; error: string } | null>(null)
  const [conversations, setConversations] = useState<StoredConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load conversation history on mount
  useEffect(() => {
    setConversations(loadFromStorage())
  }, [])

  // Auto-save when messages settle (skip while streaming)
  useEffect(() => {
    if (!activeConversationId || messages.length === 0) return
    if (messages.some((m) => m.streaming)) return

    const stripped: StoredMessage[] = messages.map(({ id, role, content }) => ({ id, role, content }))
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === activeConversationId ? { ...c, messages: stripped } : c
      )
      saveToStorage(updated)
      return updated
    })
  }, [messages, activeConversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (mealPlanDraft) {
      setPlanNameInput(mealPlanDraft.plan.name)
      setSaveResult(null)
    }
  }, [mealPlanDraft])

  const adjustHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const handleNewConversation = useCallback(() => {
    setMessages([])
    setMealPlanDraft(null)
    setSaveResult(null)
    setPlanNameInput('')
    setActiveConversationId(null)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    textareaRef.current?.focus()
  }, [])

  const handleLoadConversation = useCallback((conv: StoredConversation) => {
    setMessages(conv.messages)
    setMealPlanDraft(null)
    setSaveResult(null)
    setPlanNameInput('')
    setActiveConversationId(conv.id)
    setInput('')
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    // Build API history before mutating state
    const historyForApi = messages
      .filter((m) => !m.streaming && m.content.trim() !== '')
      .map(({ role, content }) => ({ role, content }))

    // Create conversation on first message
    let convId = activeConversationId
    if (!convId) {
      convId = crypto.randomUUID()
      const title = text.length > 52 ? text.slice(0, 52) + '…' : text
      const newConv: StoredConversation = { id: convId, title, createdAt: Date.now(), messages: [] }
      setActiveConversationId(convId)
      setConversations((prev) => {
        const updated = [newConv, ...prev]
        saveToStorage(updated)
        return updated
      })
    }

    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: text },
      { id: assistantId, role: 'assistant', content: '', streaming: true },
    ])
    setInput('')
    setLoading(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const requestBody: Record<string, unknown> = {
        messages: [...historyForApi, { role: 'user', content: text }],
        workspace_id: workspaceId,
      }
      if (mealPlanDraft) {
        requestBody.draft_plan = mealPlanDraft.plan
        requestBody.client_id = mealPlanDraft.clientId
      }

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const incomingClientId = res.headers.get('X-Meal-Plan-Client-Id')
      const incomingClientName = res.headers.get('X-Meal-Plan-Client-Name')
        ? decodeURIComponent(res.headers.get('X-Meal-Plan-Client-Name')!)
        : null

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
        )
      }

      if (incomingClientId && incomingClientName) {
        const extractRes = await fetch('/api/meal-plan/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: accumulated }),
        })
        if (extractRes.ok) {
          const data = await extractRes.json() as { plan?: MealPlanJSON }
          if (data.plan) {
            setMealPlanDraft({
              plan: data.plan,
              clientId: incomingClientId,
              clientName: incomingClientName,
              messageId: assistantId,
            })
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: `Error: ${msg}` } : m))
      )
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
      )
      setLoading(false)
    }
  }, [input, loading, workspaceId, mealPlanDraft, messages, activeConversationId])

  const handleSavePlan = useCallback(async () => {
    if (!mealPlanDraft || saving) return
    setSaving(true)

    try {
      const effectiveName = planNameInput.trim() || mealPlanDraft.plan.name
      const res = await fetch('/api/meal-plan/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: mealPlanDraft.clientId,
          workspace_id: workspaceId,
          plan: { ...mealPlanDraft.plan, name: effectiveName },
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      setSaveResult({ success: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setSaveResult({ success: false, error: msg })
    } finally {
      setSaving(false)
    }
  }, [mealPlanDraft, planNameInput, saving, workspaceId])

  const handleRefine = useCallback(() => {
    textareaRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const canSend = input.trim().length > 0 && !loading

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '32px 24px 24px', flexShrink: 0 }}>
        <h1
          className="text-2xl"
          style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
        >
          Assistant
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Ask anything about your clients, or say &quot;create a meal plan for [client name]&quot;.
        </p>
      </div>

      {/* Body: sidebar + chat */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', padding: '0 24px 24px', gap: 16 }}>

        {/* Conversation sidebar */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--color-surface-2)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
          }}
        >
          {/* New conversation */}
          <div style={{ padding: '12px', flexShrink: 0, borderBottom: '1px solid var(--color-border)' }}>
            <button
              type="button"
              onClick={handleNewConversation}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-3)',
                color: 'var(--color-text-primary)',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
            >
              <Plus size={13} />
              New conversation
            </button>
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length === 0 ? (
              <div
                style={{
                  padding: '24px 14px',
                  textAlign: 'center',
                  color: 'var(--color-text-hint)',
                  fontSize: '0.78rem',
                }}
              >
                No past conversations
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeConversationId
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleLoadConversation(conv)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: 'none',
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: isActive
                        ? 'var(--color-surface-3)'
                        : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.12s',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 7,
                      }}
                    >
                      <MessageSquare
                        size={12}
                        style={{
                          flexShrink: 0,
                          marginTop: 2,
                          color: isActive
                            ? 'var(--color-accent)'
                            : 'var(--color-text-hint)',
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: isActive ? 500 : 400,
                            color: isActive
                              ? 'var(--color-text-primary)'
                              : 'var(--color-text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {conv.title}
                        </div>
                        <div
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--color-text-hint)',
                            marginTop: 2,
                          }}
                        >
                          {relativeTime(conv.createdAt)}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Chat area */}
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
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-hint)',
                  fontSize: '0.875rem',
                }}
              >
                Ask anything about your clients.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {messages.map((msg) => {
                  return (
                    <div key={msg.id}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '72%',
                            padding: '10px 14px',
                            borderRadius:
                              msg.role === 'user'
                                ? '12px 12px 2px 12px'
                                : '12px 12px 12px 2px',
                            backgroundColor:
                              msg.role === 'user'
                                ? 'var(--color-accent)'
                                : 'var(--color-surface-3)',
                            color:
                              msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
                            fontSize: '0.875rem',
                            lineHeight: '1.6',
                            wordBreak: 'break-word',
                          }}
                        >
                          {msg.role === 'user' ? (
                            <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                          ) : (
                            <div className="prose-assistant">
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => (
                                    <p style={{ margin: '0 0 8px', lineHeight: '1.6' }}>{children}</p>
                                  ),
                                  ul: ({ children }) => (
                                    <ul style={{ margin: '4px 0 8px', paddingLeft: 20, listStyleType: 'disc' }}>{children}</ul>
                                  ),
                                  ol: ({ children }) => (
                                    <ol style={{ margin: '4px 0 8px', paddingLeft: 20, listStyleType: 'decimal' }}>{children}</ol>
                                  ),
                                  li: ({ children }) => (
                                    <li style={{ margin: '2px 0' }}>{children}</li>
                                  ),
                                  strong: ({ children }) => (
                                    <strong style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{children}</strong>
                                  ),
                                  em: ({ children }) => (
                                    <em style={{ fontStyle: 'italic' }}>{children}</em>
                                  ),
                                  code: ({ children }) => (
                                    <code
                                      style={{
                                        backgroundColor: 'rgba(0,0,0,0.25)',
                                        borderRadius: 4,
                                        padding: '1px 5px',
                                        fontSize: '0.82em',
                                        fontFamily: 'monospace',
                                      }}
                                    >
                                      {children}
                                    </code>
                                  ),
                                  pre: ({ children }) => (
                                    <pre
                                      style={{
                                        backgroundColor: 'rgba(0,0,0,0.25)',
                                        borderRadius: 6,
                                        padding: '10px 12px',
                                        overflowX: 'auto',
                                        margin: '6px 0 8px',
                                        fontSize: '0.82em',
                                        fontFamily: 'monospace',
                                      }}
                                    >
                                      {children}
                                    </pre>
                                  ),
                                  table: ({ children }) => (
                                    <div style={{ overflowX: 'auto', margin: '6px 0 8px' }}>
                                      <table style={{ borderCollapse: 'collapse', fontSize: '0.82em', width: '100%' }}>
                                        {children}
                                      </table>
                                    </div>
                                  ),
                                  th: ({ children }) => (
                                    <th style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '4px 8px', textAlign: 'left', backgroundColor: 'rgba(0,0,0,0.2)', fontWeight: 600 }}>
                                      {children}
                                    </th>
                                  ),
                                  td: ({ children }) => (
                                    <td style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px' }}>
                                      {children}
                                    </td>
                                  ),
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                              {msg.streaming && (
                                <span
                                  className="animate-pulse"
                                  style={{ display: 'inline-block', color: 'var(--color-text-hint)' }}
                                >
                                  ▋
                                </span>
                              )}
                            </div>
                          )}
                          {msg.role === 'user' && msg.streaming && (
                            <span
                              className="animate-pulse"
                              style={{ display: 'inline-block', marginLeft: 2, color: 'rgba(255,255,255,0.7)' }}
                            >
                              ▋
                            </span>
                          )}
                        </div>
                      </div>

                    </div>
                  )
                })}

                {/* Persistent meal plan save card */}
                {mealPlanDraft && (
                  <div
                    style={{
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface-1)',
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {saveResult?.success ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          color: '#22c55e',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                        }}
                      >
                        <CheckCircle size={18} />
                        <span>
                          &ldquo;{planNameInput.trim() || mealPlanDraft.plan.name}&rdquo; saved and assigned to {mealPlanDraft.clientName}.
                        </span>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-hint)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Meal Plan
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                            For: <strong style={{ color: 'var(--color-text-primary)' }}>{mealPlanDraft.clientName}</strong>
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label
                            htmlFor="plan-name-input"
                            style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}
                          >
                            Plan name
                          </label>
                          <input
                            id="plan-name-input"
                            type="text"
                            value={planNameInput}
                            onChange={(e) => setPlanNameInput(e.target.value)}
                            style={{
                              backgroundColor: 'var(--color-surface-3)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-md)',
                              padding: '7px 10px',
                              color: 'var(--color-text-primary)',
                              fontSize: '0.875rem',
                              outline: 'none',
                            }}
                          />
                        </div>
                        {saveResult && !saveResult.success && (
                          <div style={{ fontSize: '0.8rem', color: '#f87171' }}>
                            {saveResult.error}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleSavePlan}
                          disabled={saving}
                          style={{
                            alignSelf: 'flex-start',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            padding: '9px 18px',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            backgroundColor: saving ? 'var(--color-surface-3)' : 'var(--color-accent)',
                            color: saving ? 'var(--color-text-hint)' : '#fff',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.15s',
                          }}
                        >
                          {saving ? (
                            <>
                              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                              Saving…
                            </>
                          ) : (
                            <>
                              <Save size={14} />
                              Save Plan
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Refinement mode banner */}
          {mealPlanDraft && !saving && !saveResult?.success && (
            <div
              style={{
                flexShrink: 0,
                borderTop: '1px solid var(--color-border)',
                padding: '8px 16px',
                backgroundColor: 'var(--color-surface-1)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.78rem',
                color: 'var(--color-text-muted)',
              }}
            >
              <CheckCircle size={13} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
              Meal plan ready for {mealPlanDraft.clientName}. Type to refine, or save using the card above.
            </div>
          )}

          {/* Input bar */}
          <div
            style={{
              flexShrink: 0,
              borderTop: '1px solid var(--color-border)',
              padding: '12px 16px',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-end',
              backgroundColor: 'var(--color-surface-1)',
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                adjustHeight()
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                mealPlanDraft
                  ? `Refine the meal plan for ${mealPlanDraft.clientName}…`
                  : 'Message assistant…'
              }
              rows={1}
              style={{
                flex: 1,
                resize: 'none',
                backgroundColor: 'var(--color-surface-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'var(--color-text-primary)',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                outline: 'none',
                overflowY: 'hidden',
                minHeight: '42px',
                maxHeight: '200px',
              }}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!canSend}
              style={{
                width: 38,
                height: 38,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: canSend ? 'var(--color-accent)' : 'var(--color-surface-3)',
                color: canSend ? '#fff' : 'var(--color-text-hint)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: canSend ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.15s, color 0.15s',
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
