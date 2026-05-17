import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
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

  const supabase = adminClient()

  const { data: exercises, error: exercisesError } = await supabase
    .from('exercises')
    .select('id, name, muscle_group, equipment')
    .or(`workspace_id.is.null,workspace_id.eq.${workspace_id}`)

  if (exercisesError) {
    return Response.json({ error: 'Failed to fetch exercises' }, { status: 500 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    temperature: 0,
    system: 'You are an expert personal trainer and strength coach. Output ONLY valid JSON, no markdown fences, no explanation.',
    messages: [
      {
        role: 'user',
        content: `${
          current_template
            ? `Here is the current workout template:\n${JSON.stringify(current_template, null, 2)}\n\nApply this edit instruction and return the complete modified template using the same JSON schema:\n"${description}"`
            : `Generate a workout template based on this description: "${description}"`
        }

Available exercises — use names from this list when possible, otherwise invent appropriate ones:
${JSON.stringify(exercises.map((e) => ({ name: e.name, muscle_group: e.muscle_group, equipment: e.equipment })))}

Return this exact JSON schema:
{
  "name": "template name",
  "notes": "optional coaching notes",
  "exercises": [
    {
      "exercise_name": "Barbell Bench Press",
      "muscle_group": "chest",
      "equipment": "barbell",
      "rest_seconds": 90,
      "notes": "",
      "sets": [
        { "set_number": 1, "target_reps": 6, "target_weight": "", "rpe": "8", "notes": "" },
        { "set_number": 2, "target_reps": 8, "target_weight": "", "rpe": "8", "notes": "" },
        { "set_number": 3, "target_reps": 10, "target_weight": "", "rpe": "7", "notes": "" }
      ]
    }
  ]
}

Rules:
- Each exercise must have individual set definitions, not a generic rep range
- Vary reps per set when appropriate (pyramid, reverse pyramid, straight sets, etc.)
- rest_seconds should be realistic (60-180s depending on exercise type)
- Use exercise names exactly as they appear in the available list when possible`,
      },
    ],
  })

  const rawText = (response.content[0] as { text: string }).text.trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/)
    if (!match) {
      return Response.json({ error: 'AI returned invalid JSON', raw: rawText.slice(0, 500) }, { status: 500 })
    }
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return Response.json({ error: 'AI returned invalid JSON', raw: rawText.slice(0, 500) }, { status: 500 })
    }
  }

  const aiPlan = parsed as {
    name: string
    notes: string
    exercises: Array<{
      exercise_name: string
      muscle_group: string
      equipment: string
      rest_seconds: number
      notes: string
      sets: Array<{
        set_number: number
        target_reps: number
        target_weight: string
        rpe: string
        notes: string
      }>
    }>
  }

  const resultExercises = []
  for (const aiEx of aiPlan.exercises ?? []) {
    const match = exercises.find(
      (e) => e.name.toLowerCase() === aiEx.exercise_name.toLowerCase()
    )

    let exerciseId: string
    if (match) {
      exerciseId = match.id
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
    }

    resultExercises.push({
      exerciseId,
      exerciseName: aiEx.exercise_name,
      muscleGroup: aiEx.muscle_group,
      restSeconds: aiEx.rest_seconds,
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

  return Response.json({
    name: aiPlan.name,
    notes: aiPlan.notes ?? '',
    exercises: resultExercises,
  })
}
