import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const FOODS = [
  // PROTEINS
  { name: 'Chicken Breast (cooked)', calories_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6 },
  { name: 'Chicken Breast (raw)', calories_per_100g: 120, protein_per_100g: 22, carbs_per_100g: 0, fat_per_100g: 2.6 },
  { name: 'Chicken Thigh (cooked)', calories_per_100g: 209, protein_per_100g: 26, carbs_per_100g: 0, fat_per_100g: 11 },
  { name: 'Ground Beef 80% lean (cooked)', calories_per_100g: 254, protein_per_100g: 26, carbs_per_100g: 0, fat_per_100g: 17 },
  { name: 'Ground Beef 90% lean (cooked)', calories_per_100g: 218, protein_per_100g: 27, carbs_per_100g: 0, fat_per_100g: 12 },
  { name: 'Beef Steak (cooked)', calories_per_100g: 271, protein_per_100g: 29, carbs_per_100g: 0, fat_per_100g: 17 },
  { name: 'Salmon (cooked)', calories_per_100g: 208, protein_per_100g: 28, carbs_per_100g: 0, fat_per_100g: 10 },
  { name: 'Tuna (canned in water)', calories_per_100g: 116, protein_per_100g: 26, carbs_per_100g: 0, fat_per_100g: 1 },
  { name: 'Tilapia (cooked)', calories_per_100g: 128, protein_per_100g: 26, carbs_per_100g: 0, fat_per_100g: 3 },
  { name: 'Shrimp (cooked)', calories_per_100g: 99, protein_per_100g: 24, carbs_per_100g: 0, fat_per_100g: 0.3 },
  { name: 'Turkey Breast (cooked)', calories_per_100g: 189, protein_per_100g: 29, carbs_per_100g: 0, fat_per_100g: 7 },
  { name: 'Whole Egg', calories_per_100g: 143, protein_per_100g: 13, carbs_per_100g: 1, fat_per_100g: 10 },
  { name: 'Egg White', calories_per_100g: 52, protein_per_100g: 11, carbs_per_100g: 0.7, fat_per_100g: 0.2 },
  { name: 'Egg Yolk', calories_per_100g: 322, protein_per_100g: 16, carbs_per_100g: 3.6, fat_per_100g: 27 },
  { name: 'Cottage Cheese (low fat)', calories_per_100g: 72, protein_per_100g: 12, carbs_per_100g: 3, fat_per_100g: 1 },
  { name: 'Greek Yogurt (non-fat)', calories_per_100g: 59, protein_per_100g: 10, carbs_per_100g: 3.6, fat_per_100g: 0.4 },
  { name: 'Whey Protein Powder', calories_per_100g: 370, protein_per_100g: 75, carbs_per_100g: 7, fat_per_100g: 4 },
  { name: 'Casein Protein Powder', calories_per_100g: 360, protein_per_100g: 72, carbs_per_100g: 8, fat_per_100g: 3 },
  { name: 'Pork Tenderloin (cooked)', calories_per_100g: 166, protein_per_100g: 29, carbs_per_100g: 0, fat_per_100g: 5 },

  // CARBOHYDRATES
  { name: 'White Rice (cooked)', calories_per_100g: 130, protein_per_100g: 2.7, carbs_per_100g: 28, fat_per_100g: 0.3 },
  { name: 'White Rice (raw)', calories_per_100g: 365, protein_per_100g: 7, carbs_per_100g: 80, fat_per_100g: 0.7 },
  { name: 'Brown Rice (cooked)', calories_per_100g: 123, protein_per_100g: 2.7, carbs_per_100g: 26, fat_per_100g: 1 },
  { name: 'Brown Rice (raw)', calories_per_100g: 367, protein_per_100g: 8, carbs_per_100g: 77, fat_per_100g: 3 },
  { name: 'Oats (dry)', calories_per_100g: 389, protein_per_100g: 17, carbs_per_100g: 66, fat_per_100g: 7 },
  { name: 'Oats (cooked with water)', calories_per_100g: 71, protein_per_100g: 2.5, carbs_per_100g: 12, fat_per_100g: 1.5 },
  { name: 'Sweet Potato (cooked)', calories_per_100g: 90, protein_per_100g: 2, carbs_per_100g: 21, fat_per_100g: 0.1 },
  { name: 'White Potato (cooked)', calories_per_100g: 87, protein_per_100g: 1.9, carbs_per_100g: 20, fat_per_100g: 0.1 },
  { name: 'Pasta (cooked)', calories_per_100g: 158, protein_per_100g: 6, carbs_per_100g: 31, fat_per_100g: 0.9 },
  { name: 'Pasta (dry)', calories_per_100g: 371, protein_per_100g: 13, carbs_per_100g: 75, fat_per_100g: 1.5 },
  { name: 'Bread (whole wheat)', calories_per_100g: 247, protein_per_100g: 13, carbs_per_100g: 41, fat_per_100g: 4 },
  { name: 'Bread (white)', calories_per_100g: 265, protein_per_100g: 9, carbs_per_100g: 49, fat_per_100g: 3.2 },
  { name: 'Banana', calories_per_100g: 89, protein_per_100g: 1.1, carbs_per_100g: 23, fat_per_100g: 0.3 },
  { name: 'Apple', calories_per_100g: 52, protein_per_100g: 0.3, carbs_per_100g: 14, fat_per_100g: 0.2 },
  { name: 'Blueberries', calories_per_100g: 57, protein_per_100g: 0.7, carbs_per_100g: 14, fat_per_100g: 0.3 },
  { name: 'Strawberries', calories_per_100g: 32, protein_per_100g: 0.7, carbs_per_100g: 8, fat_per_100g: 0.3 },
  { name: 'Orange', calories_per_100g: 47, protein_per_100g: 0.9, carbs_per_100g: 12, fat_per_100g: 0.1 },
  { name: 'Quinoa (cooked)', calories_per_100g: 120, protein_per_100g: 4.4, carbs_per_100g: 22, fat_per_100g: 1.9 },
  { name: 'Tortilla (whole wheat)', calories_per_100g: 297, protein_per_100g: 9, carbs_per_100g: 49, fat_per_100g: 7 },

  // VEGETABLES
  { name: 'Broccoli (cooked)', calories_per_100g: 35, protein_per_100g: 2.4, carbs_per_100g: 7, fat_per_100g: 0.4 },
  { name: 'Spinach (raw)', calories_per_100g: 23, protein_per_100g: 2.9, carbs_per_100g: 3.6, fat_per_100g: 0.4 },
  { name: 'Mixed Greens (raw)', calories_per_100g: 20, protein_per_100g: 1.8, carbs_per_100g: 3, fat_per_100g: 0.3 },
  { name: 'Asparagus (cooked)', calories_per_100g: 22, protein_per_100g: 2.4, carbs_per_100g: 4, fat_per_100g: 0.2 },
  { name: 'Green Beans (cooked)', calories_per_100g: 35, protein_per_100g: 1.8, carbs_per_100g: 8, fat_per_100g: 0.1 },
  { name: 'Bell Pepper (raw)', calories_per_100g: 31, protein_per_100g: 1, carbs_per_100g: 6, fat_per_100g: 0.3 },
  { name: 'Cucumber (raw)', calories_per_100g: 15, protein_per_100g: 0.7, carbs_per_100g: 3.6, fat_per_100g: 0.1 },
  { name: 'Tomato (raw)', calories_per_100g: 18, protein_per_100g: 0.9, carbs_per_100g: 3.9, fat_per_100g: 0.2 },
  { name: 'Zucchini (cooked)', calories_per_100g: 17, protein_per_100g: 1.1, carbs_per_100g: 3.5, fat_per_100g: 0.2 },
  { name: 'Cauliflower (cooked)', calories_per_100g: 23, protein_per_100g: 1.8, carbs_per_100g: 4.1, fat_per_100g: 0.5 },
  { name: 'Mushrooms (cooked)', calories_per_100g: 28, protein_per_100g: 2, carbs_per_100g: 5, fat_per_100g: 0.4 },
  { name: 'Onion (raw)', calories_per_100g: 40, protein_per_100g: 1.1, carbs_per_100g: 9, fat_per_100g: 0.1 },
  { name: 'Corn (cooked)', calories_per_100g: 96, protein_per_100g: 3.4, carbs_per_100g: 21, fat_per_100g: 1.5 },

  // FATS
  { name: 'Olive Oil', calories_per_100g: 884, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 100 },
  { name: 'Coconut Oil', calories_per_100g: 892, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 99 },
  { name: 'Butter', calories_per_100g: 717, protein_per_100g: 0.9, carbs_per_100g: 0.1, fat_per_100g: 81 },
  { name: 'Avocado', calories_per_100g: 160, protein_per_100g: 2, carbs_per_100g: 9, fat_per_100g: 15 },
  { name: 'Almonds', calories_per_100g: 579, protein_per_100g: 21, carbs_per_100g: 22, fat_per_100g: 50 },
  { name: 'Peanut Butter', calories_per_100g: 588, protein_per_100g: 25, carbs_per_100g: 20, fat_per_100g: 50 },
  { name: 'Almond Butter', calories_per_100g: 614, protein_per_100g: 21, carbs_per_100g: 19, fat_per_100g: 56 },
  { name: 'Walnuts', calories_per_100g: 654, protein_per_100g: 15, carbs_per_100g: 14, fat_per_100g: 65 },
  { name: 'Cashews', calories_per_100g: 553, protein_per_100g: 18, carbs_per_100g: 30, fat_per_100g: 44 },
  { name: 'Cheddar Cheese', calories_per_100g: 403, protein_per_100g: 25, carbs_per_100g: 1.3, fat_per_100g: 33 },
  { name: 'Mozzarella Cheese', calories_per_100g: 280, protein_per_100g: 28, carbs_per_100g: 2.2, fat_per_100g: 17 },

  // DAIRY & OTHER
  { name: 'Whole Milk', calories_per_100g: 61, protein_per_100g: 3.2, carbs_per_100g: 4.8, fat_per_100g: 3.3 },
  { name: 'Skim Milk', calories_per_100g: 34, protein_per_100g: 3.4, carbs_per_100g: 5, fat_per_100g: 0.1 },
  { name: 'Almond Milk (unsweetened)', calories_per_100g: 15, protein_per_100g: 0.6, carbs_per_100g: 0.3, fat_per_100g: 1.2 },
  { name: 'Honey', calories_per_100g: 304, protein_per_100g: 0.3, carbs_per_100g: 82, fat_per_100g: 0 },
  { name: 'Protein Bar (generic)', calories_per_100g: 360, protein_per_100g: 30, carbs_per_100g: 40, fat_per_100g: 9 },
  { name: 'Rice Cakes', calories_per_100g: 387, protein_per_100g: 8, carbs_per_100g: 82, fat_per_100g: 3 },
  { name: 'Lentils (cooked)', calories_per_100g: 116, protein_per_100g: 9, carbs_per_100g: 20, fat_per_100g: 0.4 },
  { name: 'Black Beans (cooked)', calories_per_100g: 132, protein_per_100g: 8.9, carbs_per_100g: 24, fat_per_100g: 0.5 },
]

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: existing, error: fetchErr } = await admin
    .from('foods')
    .select('name')
    .eq('source', 'custom')

  if (fetchErr) {
    console.error('Failed to fetch existing foods:', fetchErr.message)
    process.exit(1)
  }

  const existingNames = new Set((existing ?? []).map((f: { name: string }) => f.name.toLowerCase()))

  const toInsert = FOODS
    .filter((f) => !existingNames.has(f.name.toLowerCase()))
    .map((f) => ({
      ...f,
      source: 'custom',
      external_id: null,
      brand: null,
    }))

  if (toInsert.length === 0) {
    console.log(`All ${FOODS.length} foods already seeded. Nothing to insert.`)
    return
  }

  const { data, error } = await admin
    .from('foods')
    .insert(toInsert)
    .select('id')

  if (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }

  console.log(`Seeded ${data?.length ?? 0} foods into the database (${existingNames.size} already existed).`)
}

main()
