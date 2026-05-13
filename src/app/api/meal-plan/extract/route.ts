import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const MEAL_PLAN_JSON_SCHEMA = `{
  "name": "string (descriptive plan name)",
  "plan_type": "training" or "rest",
  "notes": "string",
  "recommendations": "string",
  "meals": [
    {
      "name": "string (e.g. Breakfast, Lunch, Dinner, Snack)",
      "sort_order": number (0-based),
      "options": [
        {
          "label": "string (e.g. Option A, Option B)",
          "sort_order": number (0-based),
          "foods": [
            {
              "food_name": "string",
              "quantity": number,
              "unit": "string (g, ml, piece, cup, tbsp, etc.)",
              "calories": number,
              "protein_g": number,
              "carbs_g": number,
              "fat_g": number
            }
          ]
        }
      ]
    }
  ]
}`

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { text } = body as { text?: string }
  if (!text?.trim()) {
    return Response.json({ error: 'text is required' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system:
      'You are a data extraction assistant. Extract structured meal plan data from text and return ONLY valid JSON. No explanation, no markdown, no code fences — raw JSON only.',
    messages: [
      {
        role: 'user',
        content: `Extract the meal plan from the text below and return ONLY raw JSON matching this schema. Every meal must have at least one option and every option must have at least one food.\n\nSchema:\n${MEAL_PLAN_JSON_SCHEMA}\n\nText:\n${text}`,
      },
    ],
  })

  const raw =
    message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  try {
    const plan = JSON.parse(raw)
    return Response.json({ plan })
  } catch {
    return Response.json(
      { error: 'Claude returned unparseable JSON', raw },
      { status: 422 }
    )
  }
}
