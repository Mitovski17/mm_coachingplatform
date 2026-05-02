'use server'

import { createClient } from '@supabase/supabase-js'

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
  { id: 'current_weight',      label: 'What is your weight today?',                            type: 'number',  optional: true },
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
  { id: 'biggest_win',       label: 'What was your biggest win this week?',   type: 'text' },
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
  const { data } = await admin
    .from('clients')
    .select('id, workspace_id')
    .eq('email', email)
    .maybeSingle()
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

  if (existing) return existing as CheckinTemplate

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
}

export async function uploadProgressPhoto(formData: FormData): Promise<string> {
  const file        = formData.get('file')        as File
  const workspaceId = formData.get('workspaceId') as string
  const clientId    = formData.get('clientId')    as string

  if (!file || !workspaceId || !clientId) throw new Error('Missing required fields')

  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${workspaceId}/${clientId}/${Date.now()}.${ext}`

  const admin = adminClient()
  const { data, error } = await admin.storage
    .from('progress-photos')
    .upload(path, file)

  if (error) throw new Error(error.message)
  return data.path
}
