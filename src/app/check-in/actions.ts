'use server'

import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications'

export type QuestionType = 'scale_1_10' | 'options' | 'text' | 'photo' | 'number' | 'choice'

export interface ChoiceOption {
  value: string
  label: string
  emoji: string
}

export interface Question {
  id: string
  label: string
  type: QuestionType
  optional?: boolean
  options?: number[]
  choiceOptions?: ChoiceOption[]
}

export interface CheckinTemplate {
  id: string
  workspace_id: string
  name: string
  questions: Question[]
}

const DEFAULT_QUESTIONS: Question[] = [
  { id: 'current_weight',      label: 'What is your weight today?',                            type: 'number' },
  { id: 'performance_rating',  label: 'How did this week go overall?',                          type: 'scale_1_10' },
  {
    id: 'nutrition_adherence',
    label: 'How closely did you follow your nutrition plan?',
    type: 'options',
    options: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  },
  {
    id: 'training_adherence',
    label: 'How closely did you follow your training plan?',
    type: 'options',
    options: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  },
  { id: 'sleep_quality',       label: 'How was your sleep?',                                    type: 'scale_1_10' },
  {
    id: 'stress_level',
    label: 'How stressed were you?',
    type: 'choice',
    choiceOptions: [
      { value: 'none',   label: 'No stress',    emoji: '😌' },
      { value: 'low',    label: 'Low stress',   emoji: '🙂' },
      { value: 'medium', label: 'Medium stress', emoji: '😤' },
      { value: 'high',   label: 'Stressful',    emoji: '🤯' },
    ],
  },
  {
    id: 'energy_level',
    label: 'How were your energy levels?',
    type: 'choice',
    choiceOptions: [
      { value: 'low',       label: 'Low energy',    emoji: '🪫' },
      { value: 'sometimes', label: 'Sometimes low', emoji: '😐' },
      { value: 'normal',    label: 'Normal',         emoji: '⚡' },
      { value: 'high',      label: 'Energetic',      emoji: '🔋' },
    ],
  },
  { id: 'biggest_challenge', label: 'What was your biggest challenge?',        type: 'text' },
  { id: 'schedule_changes',  label: 'Any upcoming schedule changes?',          type: 'text',  optional: true },
  { id: 'anything_else',     label: 'Anything else for your coach?',           type: 'text',  optional: true },
  { id: 'progress_photo',    label: 'Upload a progress photo (optional, coach-only)', type: 'photo', optional: true },
]

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function getClientByEmail(email: string): Promise<{ id: string; workspace_id: string } | null> {
  const admin = adminClient()
  const { data, error } = await admin
    .from('clients')
    .select('id, workspace_id')
    .eq('email', email)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ?? null
}

export async function ensureDefaultTemplate(workspaceId: string): Promise<CheckinTemplate> {
  const admin = adminClient()

  const { data: existing } = await admin
    .from('checkin_templates')
    .select('id, workspace_id, name, questions')
    .eq('workspace_id', workspaceId)
    .limit(1)
    .maybeSingle()

  if (existing) {
    const existingQ = existing.questions as Question[]
    const existingIds = new Set(existingQ.map((q) => q.id))
    const missingQuestions = DEFAULT_QUESTIONS.filter((q) => !existingIds.has(q.id))

    if (missingQuestions.length > 0) {
      // Insert missing questions before the photo question (always last)
      const photoIdx = existingQ.findIndex((q) => q.id === 'progress_photo')
      const merged = photoIdx >= 0
        ? [...existingQ.slice(0, photoIdx), ...missingQuestions, ...existingQ.slice(photoIdx)]
        : [...existingQ, ...missingQuestions]

      await admin
        .from('checkin_templates')
        .update({ questions: merged })
        .eq('id', existing.id)

      return { ...existing, questions: merged } as CheckinTemplate
    }

    return existing as CheckinTemplate
  }

  const { data: created, error } = await admin
    .from('checkin_templates')
    .insert({
      workspace_id: workspaceId,
      name: 'Weekly Check-in',
      questions: DEFAULT_QUESTIONS,
    })
    .select('id, workspace_id, name, questions')
    .single()

  if (error || !created) throw new Error(error?.message ?? 'Failed to create template')

  return created as CheckinTemplate
}

export async function getExistingCheckin(
  clientId: string,
  weekStartDate: string
): Promise<boolean> {
  const admin = adminClient()
  const { data } = await admin
    .from('checkins')
    .select('id')
    .eq('client_id', clientId)
    .eq('week_start_date', weekStartDate)
    .maybeSingle()
  return data !== null
}

export async function submitCheckin(payload: {
  workspace_id: string
  client_id: string
  template_id: string
  answers: Record<string, string | number | string[] | null>
  week_start_date: string
}): Promise<void> {
  const admin = adminClient()
  const { error } = await admin.from('checkins').insert({
    ...payload,
    status: 'pending',
  })
  if (error) throw new Error(error.message)

  const { data: clientRow } = await admin
    .from('clients')
    .select('coach_id, full_name')
    .eq('id', payload.client_id)
    .single()

  if (clientRow?.coach_id) {
    await createNotification({
      workspaceId: payload.workspace_id,
      recipientType: 'coach',
      recipientId: clientRow.coach_id,
      type: 'new_checkin',
      title: 'New check-in submitted',
      body: `${clientRow.full_name} submitted their weekly check-in`,
      link: '/coach/check-ins',
    })
  }
}

export async function getPhotoUploadUrl(
  workspaceId: string,
  clientId: string,
  filename: string
): Promise<{ signedUrl: string; token: string; path: string }> {
  if (!workspaceId || !clientId || !filename) throw new Error('Missing required fields')

  const ext  = filename.split('.').pop() ?? 'jpg'
  const path = `${workspaceId}/${clientId}/${Date.now()}.${ext}`

  const admin = adminClient()
  const { data, error } = await admin.storage
    .from('progress-photos')
    .createSignedUploadUrl(path)

  if (error || !data) throw new Error(`Failed to create upload URL: ${error?.message}`)
  return { signedUrl: data.signedUrl, token: data.token, path: data.path }
}
