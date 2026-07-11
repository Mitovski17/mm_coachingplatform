import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { requireCoach, authErrorResponse } from '@/lib/auth'

export const maxDuration = 60

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

type AiSet = {
  set_number: number
  target_reps: number
  target_weight?: string
  rpe?: string
  notes?: string
}

type AiExercise = {
  exercise_name: string
  muscle_group: string
  equipment: string
  rest_seconds: number
  notes?: string
  sets: AiSet[]
}

type AiDay = {
  label: string
  notes?: string
  exercises: AiExercise[]
}

type AiResponse = {
  name: string
  notes?: string
  days: AiDay[]
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { description, workspace_id, current_template } = body as {
      description?: string
      workspace_id?: string
      current_template?: unknown
    }

    if (!description?.trim()) {
      return Response.json({ error: 'description is required' }, { status: 400 })
    }
    if (!workspace_id) {
      return Response.json({ error: 'workspace_id is required' }, { status: 400 })
    }

    let coach
    try {
      coach = await requireCoach()
    } catch (e) {
      const r = authErrorResponse(e)
      if (r) return r
      throw e
    }
    if (workspace_id !== coach.workspaceId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = adminClient()

    const { data: exercisesRaw, error: exercisesError } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, equipment')
      .or(`workspace_id.is.null,workspace_id.eq.${workspace_id}`)

    if (exercisesError) {
      return Response.json({ error: 'Failed to fetch exercises' }, { status: 500 })
    }

    const exercises = exercisesRaw ?? []

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const schemaExample = JSON.stringify({
      name: 'Upper/Lower 4-Day Split',
      notes: 'Optional coaching notes',
      days: [
        {
          label: 'Day 1 – Upper Push',
          notes: '',
          exercises: [
            {
              exercise_name: 'Barbell Bench Press',
              muscle_group: 'chest',
              equipment: 'barbell',
              rest_seconds: 90,
              notes: '',
              sets: [
                { set_number: 1, target_reps: 6, target_weight: '', rpe: '8', notes: '' },
                { set_number: 2, target_reps: 8, target_weight: '', rpe: '8', notes: '' },
                { set_number: 3, target_reps: 10, target_weight: '', rpe: '7', notes: '' },
              ],
            },
          ],
        },
      ],
    }, null, 2)

    const userMessage = current_template
      ? `Here is the current workout template:\n${JSON.stringify(current_template, null, 2)}\n\nApply this instruction and return the complete modified template using the SAME JSON schema:\n"${description}"`
      : `Generate a workout template based on this description: "${description}"`

    let aiRawText: string
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        temperature: 0,
        system: `You are an expert personal trainer and strength coach.
Output ONLY valid JSON — no markdown fences, no explanation, no extra text whatsoever.
The JSON must start with { and end with }.
Be concise: use short notes (or omit them), keep exercise names brief, limit to 4 sets per exercise maximum.`,
        messages: [
          {
            role: 'user',
            content: `${userMessage}

Available exercises — use EXACT names from this list when possible:
${JSON.stringify(exercises.map((e) => ({ name: e.name, muscle_group: e.muscle_group, equipment: e.equipment })))}

Return EXACTLY this JSON schema (no extra keys, no markdown):
${schemaExample}

Rules:
- Always use the "days" array, even for a single-day template
- Give each day a descriptive label (e.g. "Day 1 – Upper Push", "Day 2 – Lower Quads")
- Include ONLY training days in the days array — omit rest days entirely
- Each exercise must have individual set definitions (3–4 sets per exercise, no more)
- Vary reps per set when appropriate (pyramid, reverse pyramid, straight sets, etc.)
- rest_seconds should be realistic: 60–90s isolation, 120–180s compound lifts
- Use exercise names EXACTLY as they appear in the available list when possible
- target_weight and notes can be empty string — keep them short or empty to save space`,
          },
        ],
      })

      if (response.stop_reason === 'max_tokens') {
        console.error('[generate-template] Response truncated at max_tokens')
        return Response.json({ error: 'The generated plan was too large. Try requesting fewer days or exercises.' }, { status: 500 })
      }

      aiRawText = (response.content[0] as { text: string }).text.trim()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[generate-template] Anthropic error:', message)
      return Response.json({ error: `AI request failed: ${message}` }, { status: 500 })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(aiRawText)
    } catch {
      const match = aiRawText.match(/\{[\s\S]*\}/)
      if (!match) {
        console.error('[generate-template] Unparseable AI output:', aiRawText.slice(0, 300))
        return Response.json({ error: 'AI returned invalid JSON', raw: aiRawText.slice(0, 500) }, { status: 500 })
      }
      try {
        parsed = JSON.parse(match[0])
      } catch {
        return Response.json({ error: 'AI returned invalid JSON', raw: aiRawText.slice(0, 500) }, { status: 500 })
      }
    }

    const aiPlan = parsed as AiResponse

    // Normalise: if AI still returned flat `exercises` (legacy fallback), wrap in one day
    if (!aiPlan.days && (aiPlan as unknown as { exercises?: AiExercise[] }).exercises) {
      const legacy = aiPlan as unknown as { name: string; notes?: string; exercises: AiExercise[] }
      aiPlan.days = [{ label: 'Day 1', notes: '', exercises: legacy.exercises }]
    }

    if (!Array.isArray(aiPlan.days) || aiPlan.days.length === 0) {
      return Response.json({ error: 'AI returned no days', raw: aiRawText.slice(0, 500) }, { status: 500 })
    }

    // Resolve exercise names → DB IDs (insert new ones if not found)
    const exerciseCache = new Map(exercises.map((e) => [e.name.toLowerCase(), e]))

    const resolvedDays = []
    for (const day of aiPlan.days) {
      const resolvedExercises = []
      for (const aiEx of day.exercises ?? []) {
        const found = exerciseCache.get(aiEx.exercise_name.toLowerCase())
        let exerciseId: string

        if (found) {
          exerciseId = found.id
        } else {
          const { data: inserted, error: insertError } = await supabase
            .from('exercises')
            .insert({
              name: aiEx.exercise_name,
              muscle_group: aiEx.muscle_group,
              equipment: aiEx.equipment,
              workspace_id,
            })
            .select('id')
            .single()

          if (insertError || !inserted) {
            return Response.json({ error: `Failed to insert exercise: ${aiEx.exercise_name}` }, { status: 500 })
          }
          exerciseId = inserted.id
          exerciseCache.set(aiEx.exercise_name.toLowerCase(), {
            id: exerciseId,
            name: aiEx.exercise_name,
            muscle_group: aiEx.muscle_group,
            equipment: aiEx.equipment,
          })
        }

        resolvedExercises.push({
          exerciseId,
          exerciseName: aiEx.exercise_name,
          muscleGroup: aiEx.muscle_group,
          restSeconds: aiEx.rest_seconds ?? 90,
          notes: aiEx.notes ?? '',
          sets: (aiEx.sets ?? []).map((s) => ({
            setNumber: s.set_number,
            targetReps: s.target_reps,
            targetWeight: s.target_weight ?? '',
            rpe: s.rpe ?? '',
            notes: s.notes ?? '',
          })),
        })
      }

      resolvedDays.push({
        label: day.label,
        notes: day.notes ?? '',
        exercises: resolvedExercises,
      })
    }

    return Response.json({
      name: aiPlan.name,
      notes: aiPlan.notes ?? '',
      days: resolvedDays,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-template] Unhandled error:', message)
    return Response.json({ error: `Internal error: ${message}` }, { status: 500 })
  }
}
