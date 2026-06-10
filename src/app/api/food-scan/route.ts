import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

type ScannedFood = {
  name: string
  quantity: number
  unit: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { imageBase64, mimeType } = body as { imageBase64?: string; mimeType?: string }
  if (!imageBase64 || !mimeType) {
    return Response.json({ error: 'imageBase64 and mimeType are required' }, { status: 400 })
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
  type ValidMime = (typeof validTypes)[number]
  if (!validTypes.includes(mimeType as ValidMime)) {
    return Response.json({ error: 'Unsupported image type' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    temperature: 0,
    system: 'You are a nutrition expert that analyzes food photos. Output ONLY a JSON array, no markdown, no explanation, no code fences.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as ValidMime,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Identify each distinct food item visible in this meal photo. For each item estimate the portion size and calculate the total macros for that estimated portion.

Return a JSON array with this exact schema (no other text, no markdown):
[
  {
    "name": "food name in English",
    "quantity": 150,
    "unit": "g",
    "calories": 180,
    "proteinG": 25,
    "carbsG": 5,
    "fatG": 6
  }
]

Rules:
- Use common food names in English
- quantity is in grams (unit "g") unless it is a liquid (use ml, unit "ml") or a countable whole item (use 1, unit "piece")
- calories, proteinG, carbsG, fatG are totals for the estimated quantity, not per 100g
- Include every clearly visible food item including sauces and garnishes
- If the image does not contain food or you cannot identify any items, return []`,
          },
        ],
      },
    ],
  })

  const rawText = (response.content[0] as { text: string }).text.trim()

  let foods: ScannedFood[]
  try {
    foods = JSON.parse(rawText)
  } catch {
    const match = rawText.match(/\[[\s\S]*\]/)
    if (!match) return Response.json({ foods: [] })
    try {
      foods = JSON.parse(match[0])
    } catch {
      return Response.json({ foods: [] })
    }
  }

  if (!Array.isArray(foods)) return Response.json({ foods: [] })

  return Response.json({ foods })
}
