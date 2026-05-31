import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

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

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let response: Awaited<ReturnType<typeof anthropic.messages.create>>
  try {
    response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    temperature: 0,
    system: 'You are a nutrition expert. The user will either describe a meal plan they want generated, OR paste an existing meal plan. In both cases, output ONLY a valid JSON object matching the schema provided - no markdown fences, no explanation. Always use sensible units: "piece" for countable foods (eggs, fruit, bread slices, chicken breasts), "g" for weighed foods, "ml" for liquids, "tbsp"/"tsp" for condiments and oils. Never assign "g" to whole countable foods.',
    messages: [
      {
        role: 'user',
        content: current_plan
          ? `Here is the current meal plan as JSON:\n${JSON.stringify(current_plan, null, 2)}\n\nApply this edit instruction and return the complete modified plan using the same JSON schema:\n"${description}"`
          : `Generate a complete meal plan template based on this description: "${description}"

Return a JSON object with this exact schema:
{
  "name": "descriptive template name",
  "plan_type": "training",
  "notes": "brief notes for the client",
  "recommendations": "brief recommendations",
  "meals": [
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
  ]
}

Rules:
- Use realistic food quantities and accurate macros (do not estimate wildly)
- If the description asks for multiple options per meal, include them as separate option objects with labels "A", "B", etc.
- Meal names should be: Breakfast, Lunch, Dinner, Snack, Pre-workout, Post-workout (or similar)
- plan_type should be "training" for training days, "rest" for rest days, "overall" for plans that apply every day regardless of training
- All macro values must be numbers, not strings
- The calories field per food must be the actual calories at the given quantity (not per 100g)
- Match the calorie and macro targets specified in the description as closely as possible

Unit selection - ONLY use these exact unit values: "g", "ml", "kg", "L", "oz", "tbsp", "tsp", "cup", "piece", "serving"
Unit rules (follow strictly):
- "piece" for anything countable: eggs, chicken breasts, fish fillets, slices of bread, bananas, apples, oranges, dates, rice cakes, crackers, scoops of protein powder (1 scoop = 1 piece)
- "g" for weighed foods: meat (ground beef, chicken pieces), cheese, oats, rice, pasta, nuts, seeds, vegetables by weight
- "ml" for liquids: milk, water, juice, broth, liquid egg whites
- "tbsp" for oils, nut butters, sauces, honey, condiments
- "tsp" for spices, extracts, small amounts of oil
- "cup" for volume-measured ingredients: cottage cheese, Greek yogurt (when measured by cup), oats, salad greens
- "serving" only when no better unit applies (e.g. mixed meals, soups)
- NEVER use "g" for whole countable foods like eggs, fruit, bread slices`,
      },
    ],
  })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: `AI request failed: ${message}` }, { status: 500 })
  }

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

  return Response.json(parsed)
}
