import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a nutrition expert. Output ONLY a valid JSON array of meal objects - no markdown fences, no explanation, no wrapper object. Always use sensible units: "piece" for countable foods (eggs, fruit, bread slices, chicken breasts), "g" for weighed foods, "ml" for liquids, "tbsp"/"tsp" for condiments and oils. Never assign "g" to whole countable foods.`

const SCHEMA_RULES = `Each meal must follow this exact schema:
{
  "name": "Breakfast",
  "sort_order": 0,
  "options": [
    {
      "label": "A",
      "sort_order": 0,
      "foods": [
        {
          "food_name": "Greek Yogurt (0% fat)",
          "quantity": 200,
          "unit": "g",
          "calories": 120,
          "protein_g": 20,
          "carbs_g": 9,
          "fat_g": 0.6
        }
      ]
    }
  ]
}

Rules:
- Use realistic food quantities and accurate macros (do not estimate wildly)
- Multiple options per meal = separate option objects with labels "A", "B", "C", etc.
- All macro values must be numbers, not strings
- calories per food = actual calories at that quantity (not per 100g)
- Match calorie and macro targets from the description as closely as possible

Unit selection - ONLY use these exact unit values: "g", "ml", "kg", "L", "oz", "tbsp", "tsp", "cup", "piece", "serving"
Unit rules (follow strictly):
- "piece" for anything countable: eggs, chicken breasts, fish fillets, slices of bread, bananas, apples, oranges, dates, rice cakes, crackers, scoops of protein powder
- "g" for weighed foods: meat (ground beef, chicken pieces), cheese, oats, rice, pasta, nuts, seeds, vegetables by weight
- "ml" for liquids: milk, water, juice, broth, liquid egg whites
- "tbsp" for oils, nut butters, sauces, honey, condiments
- "tsp" for spices, extracts, small amounts of oil
- "cup" for volume-measured ingredients: cottage cheese, Greek yogurt (when measured by cup), oats, salad greens
- "serving" only when no better unit applies (e.g. mixed meals, soups)
- NEVER use "g" for whole countable foods like eggs, fruit, bread slices`

async function generateMeals(description: string, mealNames: string[], startSortOrder: number): Promise<unknown[]> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `From this full meal plan description, generate ONLY the following meals: ${mealNames.join(', ')}.

Full description:
"${description}"

${SCHEMA_RULES}

Return a JSON array containing ONLY the ${mealNames.join(' and ')} meal objects (starting sort_order at ${startSortOrder}). No other text.`,
      },
    ],
  })

  if (response.stop_reason === 'max_tokens') {
    throw new Error(`Response was truncated while generating ${mealNames.join('/')}. The meal plan may be too large.`)
  }

  const rawText = (response.content[0] as { text: string }).text.trim()

  // Try direct parse first
  try {
    return JSON.parse(rawText) as unknown[]
  } catch {
    // Try extracting JSON array
    const match = rawText.match(/\[[\s\S]*\]/)
    if (match) {
      try {
        return JSON.parse(match[0]) as unknown[]
      } catch {
        // fall through
      }
    }
    throw new Error(`Invalid JSON returned for ${mealNames.join('/')}`)
  }
}

async function generateMetadata(description: string): Promise<{ name: string; plan_type: string; notes: string; recommendations: string }> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    temperature: 0,
    system: 'You are a nutrition expert. Output ONLY a valid JSON object, no markdown fences, no explanation.',
    messages: [
      {
        role: 'user',
        content: `Based on this meal plan description, return ONLY this JSON object (no meals, just metadata):
{
  "name": "descriptive template name",
  "plan_type": "training",
  "notes": "brief notes for the client",
  "recommendations": "brief recommendations"
}

plan_type must be "training", "rest", or "overall".

Description: "${description}"`,
      },
    ],
  })

  const rawText = (response.content[0] as { text: string }).text.trim()
  try {
    return JSON.parse(rawText) as { name: string; plan_type: string; notes: string; recommendations: string }
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as { name: string; plan_type: string; notes: string; recommendations: string }
    throw new Error('Failed to generate plan metadata')
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { description, current_plan } = body as { description?: string; current_plan?: unknown }

  if (!description?.trim()) {
    return Response.json({ error: 'description is required' }, { status: 400 })
  }

  // Edit mode: pass through as a single call (editing an existing plan is usually smaller)
  if (current_plan) {
    let response: Awaited<ReturnType<typeof anthropic.messages.create>>
    try {
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        temperature: 0,
        system: 'You are a nutrition expert. The user will paste an existing meal plan. Apply the edit instruction and output ONLY a valid JSON object matching the original schema - no markdown fences, no explanation.',
        messages: [
          {
            role: 'user',
            content: `Here is the current meal plan as JSON:\n${JSON.stringify(current_plan, null, 2)}\n\nApply this edit instruction and return the complete modified plan using the same JSON schema:\n"${description}"`,
          },
        ],
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return Response.json({ error: `AI request failed: ${message}` }, { status: 500 })
    }

    if (response.stop_reason === 'max_tokens') {
      return Response.json({ error: 'Response was truncated — plan is too large for a single edit. Try editing fewer meals at once.' }, { status: 500 })
    }

    const rawText = (response.content[0] as { text: string }).text.trim()
    try {
      return Response.json(JSON.parse(rawText))
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/)
      if (match) {
        try { return Response.json(JSON.parse(match[0])) } catch { /* fall through */ }
      }
      return Response.json({ error: 'AI returned invalid JSON', raw: rawText.slice(0, 500) }, { status: 500 })
    }
  }

  // Generation mode: split into parallel calls to stay well under 8192 tokens each
  try {
    // Detect meal names from description to split intelligently
    const descLower = description.toLowerCase()
    const hasFourMeals = descLower.includes('snack') || descLower.includes('lunch')

    let firstBatch: string[]
    let secondBatch: string[]

    if (hasFourMeals) {
      firstBatch = ['Breakfast', 'Lunch']
      secondBatch = ['Snack', 'Dinner']
    } else {
      firstBatch = ['Breakfast']
      secondBatch = ['Dinner']
    }

    const [metadata, firstMeals, secondMeals] = await Promise.all([
      generateMetadata(description),
      generateMeals(description, firstBatch, 0),
      generateMeals(description, secondBatch, firstBatch.length),
    ])

    const allMeals = [...firstMeals, ...secondMeals]

    return Response.json({ ...metadata, meals: allMeals })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
