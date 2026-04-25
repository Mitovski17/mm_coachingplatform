import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Parse .env.local without an external dotenv dependency
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  const key = trimmed.slice(0, eq).trim()
  const value = trimmed.slice(eq + 1).trim()
  if (!(key in process.env)) process.env[key] = value
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function cleanSeedData() {
  // Find all seed auth users by email prefix
  const { data: { users }, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 })
  if (listError) throw listError

  const seedUsers = users.filter(
    (u) => u.email?.startsWith('seed_') && u.email.endsWith('@mitovski.dev')
  )

  if (seedUsers.length === 0) {
    console.log('No existing seed data found.')
    return
  }

  const seedIds = seedUsers.map((u) => u.id)
  const seedEmails = seedUsers.map((u) => u.email!)

  // Delete in FK-safe order: clients → profiles → workspaces → auth users
  const { error: clientsErr } = await admin.from('clients').delete().in('email', seedEmails)
  if (clientsErr) throw clientsErr

  const { error: profilesErr } = await admin.from('profiles').delete().in('id', seedIds)
  if (profilesErr) throw profilesErr

  const { data: workspaces, error: wsListErr } = await admin
    .from('workspaces')
    .select('id')
    .in('owner_id', seedIds)
  if (wsListErr) throw wsListErr

  if (workspaces && workspaces.length > 0) {
    const { error: wsDelErr } = await admin
      .from('workspaces')
      .delete()
      .in('id', workspaces.map((w) => w.id))
    if (wsDelErr) throw wsDelErr
  }

  for (const user of seedUsers) {
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) throw delErr
  }

  console.log(`Cleaned up ${seedUsers.length} seed user(s).`)
}

async function seed() {
  console.log('Cleaning up existing seed data…')
  await cleanSeedData()

  console.log('Creating seed users…')

  // ── Coach ────────────────────────────────────────────────────────────────────
  const { data: coachData, error: coachErr } = await admin.auth.admin.createUser({
    email: 'seed_coach@mitovski.dev',
    password: 'devpassword123',
    email_confirm: true,
  })
  if (coachErr) throw coachErr
  const coachId = coachData.user.id

  const { data: workspace, error: wsErr } = await admin
    .from('workspaces')
    .insert({ name: 'Seed Workspace', slug: 'seed-workspace', owner_id: coachId, plan: 'free' })
    .select()
    .single()
  if (wsErr) throw wsErr

  const { error: profileErr } = await admin
    .from('profiles')
    .insert({ id: coachId, workspace_id: workspace.id, full_name: 'Seed Coach', role: 'owner' })
  if (profileErr) throw profileErr

  // ── Fresh client (onboarding not started) ────────────────────────────────────
  const { error: freshAuthErr } = await admin.auth.admin.createUser({
    email: 'seed_client_fresh@mitovski.dev',
    password: 'devpassword123',
    email_confirm: true,
  })
  if (freshAuthErr) throw freshAuthErr

  const { error: freshClientErr } = await admin.from('clients').insert({
    workspace_id: workspace.id,
    coach_id: coachId,
    full_name: 'Seed Client Fresh',
    email: 'seed_client_fresh@mitovski.dev',
    status: 'active',
    onboarding_completed_at: null,
  })
  if (freshClientErr) throw freshClientErr

  // ── Done client (onboarding complete) ────────────────────────────────────────
  const { error: doneAuthErr } = await admin.auth.admin.createUser({
    email: 'seed_client_done@mitovski.dev',
    password: 'devpassword123',
    email_confirm: true,
  })
  if (doneAuthErr) throw doneAuthErr

  const { error: doneClientErr } = await admin.from('clients').insert({
    workspace_id: workspace.id,
    coach_id: coachId,
    full_name: 'Seed Client Done',
    email: 'seed_client_done@mitovski.dev',
    status: 'active',
    current_weight: 80,
    current_weight_unit: 'kg',
    goal: 'lose_fat',
    desired_weight: 75,
    desired_weight_unit: 'kg',
    meals_per_day: 3,
    foods_to_avoid: null,
    activity_level: 'moderately_active',
    occupation_notes: 'Office worker, mostly sitting',
    health_notes: null,
    training_location: 'gym',
    training_days_per_week: 4,
    preferred_training_time: 'morning',
    onboarding_completed_at: new Date().toISOString(),
  })
  if (doneClientErr) throw doneClientErr

  console.log('\nSeed complete.')
  console.log('  Coach:        seed_coach@mitovski.dev        / devpassword123')
  console.log('  Fresh client: seed_client_fresh@mitovski.dev / devpassword123')
  console.log('  Done client:  seed_client_done@mitovski.dev  / devpassword123')
}

seed().catch((err) => {
  console.error('Seed failed:', err.message ?? err)
  process.exit(1)
})
