import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.join(__dirname, '..', '.env.local')
const env = fs.readFileSync(envPath, 'utf8')

const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1].trim()

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EXERCISES = [
  // CHEST
  { name: 'Bench Press', muscle_group: 'chest', equipment: 'barbell' },
  { name: 'Incline Bench Press', muscle_group: 'chest', equipment: 'barbell' },
  { name: 'Decline Bench Press', muscle_group: 'chest', equipment: 'barbell' },
  { name: 'Dumbbell Fly', muscle_group: 'chest', equipment: 'dumbbell' },
  { name: 'Incline Dumbbell Press', muscle_group: 'chest', equipment: 'dumbbell' },
  { name: 'Cable Fly', muscle_group: 'chest', equipment: 'cable' },
  { name: 'Push Up', muscle_group: 'chest', equipment: 'bodyweight' },
  { name: 'Dips', muscle_group: 'chest', equipment: 'bodyweight' },
  { name: 'Chest Press Machine', muscle_group: 'chest', equipment: 'machine' },
  // BACK
  { name: 'Deadlift', muscle_group: 'back', equipment: 'barbell' },
  { name: 'Barbell Row', muscle_group: 'back', equipment: 'barbell' },
  { name: 'T-Bar Row', muscle_group: 'back', equipment: 'barbell' },
  { name: 'Pull Up', muscle_group: 'back', equipment: 'bodyweight' },
  { name: 'Chin Up', muscle_group: 'back', equipment: 'bodyweight' },
  { name: 'Lat Pulldown', muscle_group: 'back', equipment: 'cable' },
  { name: 'Seated Cable Row', muscle_group: 'back', equipment: 'cable' },
  { name: 'Straight Arm Pulldown', muscle_group: 'back', equipment: 'cable' },
  { name: 'Dumbbell Row', muscle_group: 'back', equipment: 'dumbbell' },
  { name: 'Machine Row', muscle_group: 'back', equipment: 'machine' },
  // LEGS
  { name: 'Squat', muscle_group: 'legs', equipment: 'barbell' },
  { name: 'Romanian Deadlift', muscle_group: 'legs', equipment: 'barbell' },
  { name: 'Hip Thrust', muscle_group: 'legs', equipment: 'barbell' },
  { name: 'Leg Press', muscle_group: 'legs', equipment: 'machine' },
  { name: 'Leg Curl', muscle_group: 'legs', equipment: 'machine' },
  { name: 'Leg Extension', muscle_group: 'legs', equipment: 'machine' },
  { name: 'Hack Squat', muscle_group: 'legs', equipment: 'machine' },
  { name: 'Calf Raise', muscle_group: 'legs', equipment: 'machine' },
  { name: 'Bulgarian Split Squat', muscle_group: 'legs', equipment: 'dumbbell' },
  { name: 'Dumbbell Lunge', muscle_group: 'legs', equipment: 'dumbbell' },
  { name: 'Goblet Squat', muscle_group: 'legs', equipment: 'dumbbell' },
  { name: 'Bodyweight Squat', muscle_group: 'legs', equipment: 'bodyweight' },
  // SHOULDERS
  { name: 'Overhead Press', muscle_group: 'shoulders', equipment: 'barbell' },
  { name: 'Dumbbell Shoulder Press', muscle_group: 'shoulders', equipment: 'dumbbell' },
  { name: 'Arnold Press', muscle_group: 'shoulders', equipment: 'dumbbell' },
  { name: 'Lateral Raise', muscle_group: 'shoulders', equipment: 'dumbbell' },
  { name: 'Rear Delt Fly', muscle_group: 'shoulders', equipment: 'dumbbell' },
  { name: 'Cable Lateral Raise', muscle_group: 'shoulders', equipment: 'cable' },
  { name: 'Face Pull', muscle_group: 'shoulders', equipment: 'cable' },
  { name: 'Machine Shoulder Press', muscle_group: 'shoulders', equipment: 'machine' },
  // ARMS
  { name: 'Barbell Curl', muscle_group: 'arms', equipment: 'barbell' },
  { name: 'Skull Crusher', muscle_group: 'arms', equipment: 'barbell' },
  { name: 'Close Grip Bench Press', muscle_group: 'arms', equipment: 'barbell' },
  { name: 'Dumbbell Curl', muscle_group: 'arms', equipment: 'dumbbell' },
  { name: 'Hammer Curl', muscle_group: 'arms', equipment: 'dumbbell' },
  { name: 'Overhead Tricep Extension', muscle_group: 'arms', equipment: 'dumbbell' },
  { name: 'Cable Curl', muscle_group: 'arms', equipment: 'cable' },
  { name: 'Tricep Pushdown', muscle_group: 'arms', equipment: 'cable' },
  { name: 'Overhead Cable Tricep Extension', muscle_group: 'arms', equipment: 'cable' },
  { name: 'Preacher Curl', muscle_group: 'arms', equipment: 'machine' },
  // CORE
  { name: 'Plank', muscle_group: 'core', equipment: 'bodyweight' },
  { name: 'Hanging Leg Raise', muscle_group: 'core', equipment: 'bodyweight' },
  { name: 'Russian Twist', muscle_group: 'core', equipment: 'bodyweight' },
  { name: 'Sit Up', muscle_group: 'core', equipment: 'bodyweight' },
  { name: 'Ab Wheel Rollout', muscle_group: 'core', equipment: 'other' },
  { name: 'Cable Crunch', muscle_group: 'core', equipment: 'cable' },
  // CARDIO
  { name: 'Treadmill', muscle_group: 'cardio', equipment: 'machine' },
  { name: 'Stationary Bike', muscle_group: 'cardio', equipment: 'machine' },
  { name: 'Rowing Machine', muscle_group: 'cardio', equipment: 'machine' },
  { name: 'Stair Climber', muscle_group: 'cardio', equipment: 'machine' },
  { name: 'Jump Rope', muscle_group: 'cardio', equipment: 'other' },
  { name: 'Battle Ropes', muscle_group: 'cardio', equipment: 'other' },
]

async function main() {
  console.log(`Seeding ${EXERCISES.length} exercises...`)

  const { data, error } = await admin
    .from('exercises')
    .upsert(EXERCISES, { onConflict: 'name,muscle_group,equipment', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error('Upsert error:', JSON.stringify(error, null, 2))
    process.exit(1)
  }

  const { count, error: countError } = await admin
    .from('exercises')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('Count error:', countError.message)
  } else {
    console.log(`Done. Total exercises in DB: ${count}`)
  }
}

main()
