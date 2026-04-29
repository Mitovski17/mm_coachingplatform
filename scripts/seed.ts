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

  // Fetch IDs needed for cascading deletes before any deletions
  const { data: seedClients, error: clientsListErr } = await admin
    .from('clients')
    .select('id')
    .in('email', seedEmails)
  if (clientsListErr) throw clientsListErr

  const { data: workspaces, error: wsListErr } = await admin
    .from('workspaces')
    .select('id')
    .in('owner_id', seedIds)
  if (wsListErr) throw wsListErr

  // Delete in FK-safe order: checkins → checkin_templates → clients → profiles → workspaces → auth users
  if (seedClients && seedClients.length > 0) {
    const { error: checkinsErr } = await admin
      .from('checkins')
      .delete()
      .in('client_id', seedClients.map((c) => c.id))
    if (checkinsErr) throw checkinsErr
  }

  if (workspaces && workspaces.length > 0) {
    const { error: templatesErr } = await admin
      .from('checkin_templates')
      .delete()
      .in('workspace_id', workspaces.map((w) => w.id))
    if (templatesErr) throw templatesErr
  }

  const { error: clientsErr } = await admin.from('clients').delete().in('email', seedEmails)
  if (clientsErr) throw clientsErr

  const { error: profilesErr } = await admin.from('profiles').delete().in('id', seedIds)
  if (profilesErr) throw profilesErr

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

  const { data: freshClient, error: freshClientErr } = await admin.from('clients').insert({
    workspace_id: workspace.id,
    coach_id: coachId,
    full_name: 'Seed Client Fresh',
    email: 'seed_client_fresh@mitovski.dev',
    status: 'active',
    onboarding_completed_at: null,
  }).select().single()
  if (freshClientErr) throw freshClientErr

  // ── Done client (onboarding complete) ────────────────────────────────────────
  const { error: doneAuthErr } = await admin.auth.admin.createUser({
    email: 'seed_client_done@mitovski.dev',
    password: 'devpassword123',
    email_confirm: true,
  })
  if (doneAuthErr) throw doneAuthErr

  const { data: doneClient, error: doneClientErr } = await admin.from('clients').insert({
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
  }).select().single()
  if (doneClientErr) throw doneClientErr

  // ── Check-in template ─────────────────────────────────────────────────────────
  const { data: template, error: templateErr } = await admin
    .from('checkin_templates')
    .insert({
      workspace_id: workspace.id,
      name: 'Weekly Check-in',
      questions: [
        { id: 'performance_rating',  label: 'How did this week go overall?',                  type: 'scale_1_10' },
        { id: 'nutrition_adherence', label: 'How closely did you follow your nutrition plan?', type: 'options',   options: [0, 25, 50, 75, 100] },
        { id: 'training_adherence',  label: 'How closely did you follow your training plan?',  type: 'options',   options: [0, 25, 50, 75, 100] },
        { id: 'sleep_quality',       label: 'How was your sleep?',                             type: 'scale_1_10' },
        { id: 'stress_level',        label: 'How stressed were you?',                          type: 'scale_1_10' },
        { id: 'energy_level',        label: 'How were your energy levels?',                    type: 'scale_1_10' },
        { id: 'biggest_win',         label: 'What was your biggest win this week?',            type: 'text' },
        { id: 'biggest_challenge',   label: 'What was your biggest challenge?',                type: 'text' },
        { id: 'schedule_changes',    label: 'Any upcoming schedule changes?',                  type: 'text',      optional: true },
        { id: 'anything_else',       label: 'Anything else for your coach?',                   type: 'text',      optional: true },
        { id: 'progress_photo',      label: 'Upload a progress photo (optional, coach-only)',  type: 'photo',     optional: true },
      ],
    })
    .select()
    .single()
  if (templateErr) throw templateErr

  // ── Check-ins ─────────────────────────────────────────────────────────────────
  const { error: pendingCheckinErr } = await admin.from('checkins').insert({
    workspace_id: workspace.id,
    client_id: freshClient.id,
    template_id: template.id,
    status: 'pending',
    answers: {
      weight: 72,
      energy: 6,
      notes: 'Felt good this week, a bit tired on Thursday.',
      progress_photo: null,
    },
  })
  if (pendingCheckinErr) throw pendingCheckinErr

  const now = new Date().toISOString()
  const { error: reviewedCheckinErr } = await admin.from('checkins').insert({
    workspace_id: workspace.id,
    client_id: doneClient.id,
    template_id: template.id,
    status: 'reviewed',
    answers: {
      weight: 76,
      energy: 8,
      notes: 'Great week, hit all my gym sessions.',
      progress_photo: null,
    },
    coach_notes: 'Solid progress — keep the protein high and we will hit target by end of month.',
    reviewed_at: now,
  })
  if (reviewedCheckinErr) throw reviewedCheckinErr

  console.log('\nSeed complete.')
  console.log('  Coach:        seed_coach@mitovski.dev        / devpassword123')
  console.log('  Fresh client: seed_client_fresh@mitovski.dev / devpassword123')
  console.log('  Done client:  seed_client_done@mitovski.dev  / devpassword123')
  console.log('  Template:     Weekly Check-in')
  console.log('  Check-ins:    1 pending (fresh), 1 reviewed (done)')
}

seed().catch((err) => {
  console.error('Seed failed:', err.message ?? err)
  process.exit(1)
})
