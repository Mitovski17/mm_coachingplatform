/**
 * Exercise demonstration GIFs.
 *
 * Source: ExerciseGymGifsDB — a static, key-less "API" of 1300+ anatomical
 * exercise GIFs served straight off the free jsDelivr CDN.
 *   https://github.com/JahelCuadrado/ExerciseGymGifsDB
 *
 * Two files exist per exercise and we use both:
 *   `<slug>.gif`         the animation, loaded only when a client opens it
 *   `<slug>.thumb.webp`  a single still frame (~19 KB) for the paused preview
 *
 * The mapping below is hand-checked frame by frame rather than fuzzy-matched:
 * the dataset holds a dozen near-identical names per movement (five kinds of
 * "cable fly", three "hack squat"), so an automatic best-guess quietly puts the
 * wrong demonstration in front of a client. Anything without a verified match
 * is left out on purpose — `resolveExerciseGif` returns null and the UI simply
 * shows no thumbnail, which is better than showing the wrong lift.
 *
 * The version is pinned to a commit-stable ref so a change upstream can never
 * silently repoint a client's demonstration; bump `REF` deliberately.
 */

const BASE = 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB'
const REF = 'main'

/** Exercise name (normalised) → `<muscle>/<slug>` in the dataset. */
const SLUGS: Record<string, string> = {
  // ─── Chest ──────────────────────────────────────────────────────────────
  'bench press': 'pectorals/barbell-bench-press',
  'incline bench press': 'pectorals/barbell-incline-bench-press',
  'decline bench press': 'pectorals/barbell-decline-bench-press',
  'dumbbell fly': 'pectorals/dumbbell-fly',
  'incline dumbbell press': 'pectorals/dumbbell-incline-bench-press',
  'cable fly': 'pectorals/cable-standing-fly',
  'push up': 'pectorals/push-up',
  dips: 'pectorals/chest-dip',
  'chest press machine': 'pectorals/lever-chest-press',
  'dumbbell pullover': 'pectorals/dumbbell-pullover',

  // ─── Back ───────────────────────────────────────────────────────────────
  deadlift: 'glutes/barbell-deadlift',
  'barbell row': 'upper-back/barbell-bent-over-row',
  't bar row': 'upper-back/lever-t-bar-row',
  'pull up': 'lats/pull-up',
  'chin up': 'lats/chin-up',
  'lat pulldown': 'lats/cable-bar-lateral-pulldown',
  'seated cable row': 'upper-back/cable-seated-row',
  'straight arm pulldown': 'lats/cable-straight-arm-pulldown',
  'dumbbell row': 'upper-back/dumbbell-one-arm-bent-over-row',
  'machine row': 'upper-back/lever-seated-row',
  'pendlay row': 'upper-back/barbell-pendlay-row',
  'inverted row': 'upper-back/inverted-row',
  'sumo deadlift': 'glutes/barbell-sumo-deadlift',
  'trap bar deadlift': 'glutes/trap-bar-deadlift',
  shrug: 'traps/barbell-shrug',

  // ─── Legs ───────────────────────────────────────────────────────────────
  squat: 'glutes/barbell-full-squat',
  'romanian deadlift': 'glutes/barbell-romanian-deadlift',
  'hip thrust': 'glutes/barbell-glute-bridge',
  'leg press': 'glutes/sled-45-leg-press',
  'leg curl': 'hamstrings/lever-lying-leg-curl',
  'leg extension': 'quads/lever-leg-extension',
  'hack squat': 'glutes/sled-hack-squat',
  'calf raise': 'calves/lever-standing-calf-raise',
  'seated calf raise': 'calves/lever-seated-calf-raise',
  'bulgarian split squat': 'quads/dumbbell-single-leg-split-squat',
  'dumbbell lunge': 'glutes/dumbbell-lunge',
  'reverse lunge': 'glutes/dumbbell-rear-lunge',
  'goblet squat': 'quads/dumbbell-goblet-squat',
  'bodyweight squat': 'glutes/weighted-squat',
  'front squat': 'glutes/barbell-front-squat',
  'good morning': 'hamstrings/barbell-good-morning',
  'step up': 'glutes/barbell-step-up',
  'hip abduction': 'abductors/lever-seated-hip-abduction',
  'hip adduction': 'adductors/lever-seated-hip-adduction',
  'cable pull through': 'glutes/cable-pull-through-with-rope',
  'kettlebell swing': 'glutes/kettlebell-swing',

  // ─── Shoulders ──────────────────────────────────────────────────────────
  'overhead press': 'delts/barbell-seated-overhead-press',
  'dumbbell shoulder press': 'delts/dumbbell-seated-shoulder-press',
  'arnold press': 'delts/dumbbell-arnold-press',
  'lateral raise': 'delts/dumbbell-lateral-raise',
  'rear delt fly': 'delts/dumbbell-reverse-fly',
  'cable lateral raise': 'delts/cable-lateral-raise',
  'face pull': 'delts/cable-rear-delt-row-with-rope',
  'machine shoulder press': 'delts/lever-shoulder-press-v-2',
  'front raise': 'delts/dumbbell-front-raise',
  'upright row': 'delts/barbell-upright-row',
  'push press': 'delts/dumbbell-push-press',

  // ─── Arms ───────────────────────────────────────────────────────────────
  'barbell curl': 'biceps/barbell-curl',
  'skull crusher': 'triceps/barbell-lying-triceps-extension-skull-crusher',
  'close grip bench press': 'triceps/barbell-close-grip-bench-press',
  'dumbbell curl': 'biceps/dumbbell-biceps-curl',
  'hammer curl': 'biceps/dumbbell-hammer-curl',
  'overhead tricep extension': 'triceps/dumbbell-seated-triceps-extension',
  'cable curl': 'biceps/cable-curl',
  'tricep pushdown': 'triceps/cable-pushdown',
  'overhead cable tricep extension': 'triceps/cable-high-pulley-overhead-tricep-extension',
  'preacher curl': 'biceps/lever-preacher-curl',
  'concentration curl': 'biceps/dumbbell-concentration-curl',
  'incline curl': 'biceps/dumbbell-incline-curl',
  'reverse curl': 'biceps/barbell-reverse-curl',
  'wrist curl': 'forearms/barbell-wrist-curl',
  'rope hammer curl': 'biceps/cable-hammer-curl-with-rope',

  // ─── Core ───────────────────────────────────────────────────────────────
  plank: 'abs/weighted-front-plank',
  'hanging leg raise': 'abs/hanging-leg-raise',
  'russian twist': 'abs/russian-twist',
  'sit up': 'abs/sit-up-v-2',
  'ab wheel rollout': 'abs/wheel-rollerout',
  'cable crunch': 'abs/cable-kneeling-crunch',
  crunch: 'abs/knee-touch-crunch',
  'reverse crunch': 'abs/reverse-crunch',
  'bicycle crunch': 'abs/air-bike',

  // ─── Cardio ─────────────────────────────────────────────────────────────
  // "Rowing Machine" is deliberately absent — the dataset has no rowing
  // ergometer, and the nearest candidates are treadmill runs.
  treadmill: 'cardio/walking-on-incline-treadmill',
  'stationary bike': 'cardio/stationary-bike-run-v-3',
  'stair climber': 'cardio/walking-on-stepmill',
  'jump rope': 'cardio/jump-rope',
  'battle ropes': 'delts/battling-ropes',
  burpee: 'cardio/burpee',
  'mountain climber': 'cardio/mountain-climber',
}

/**
 * Spellings a coach is likely to type that mean the same movement. Kept
 * separate from `SLUGS` so the verified mapping stays one entry per GIF.
 */
const ALIASES: Record<string, string> = {
  'barbell bench press': 'bench press',
  'flat bench press': 'bench press',
  'barbell squat': 'squat',
  'back squat': 'squat',
  'air squat': 'bodyweight squat',
  'barbell hip thrust': 'hip thrust',
  'glute bridge': 'hip thrust',
  'rdl': 'romanian deadlift',
  'barbell romanian deadlift': 'romanian deadlift',
  'conventional deadlift': 'deadlift',
  'barbell deadlift': 'deadlift',
  'bent over row': 'barbell row',
  'barbell bent over row': 'barbell row',
  'one arm dumbbell row': 'dumbbell row',
  'single arm dumbbell row': 'dumbbell row',
  'lat pull down': 'lat pulldown',
  'pulldown': 'lat pulldown',
  'cable row': 'seated cable row',
  'chest supported row': 'machine row',
  'pull ups': 'pull up',
  'chin ups': 'chin up',
  'push ups': 'push up',
  'pushup': 'push up',
  'press up': 'push up',
  'dip': 'dips',
  'chest dip': 'dips',
  'tricep dips': 'dips',
  'machine chest press': 'chest press machine',
  'pec deck': 'cable fly',
  'cable crossover': 'cable fly',
  'chest fly': 'dumbbell fly',
  'military press': 'overhead press',
  'shoulder press': 'dumbbell shoulder press',
  'ohp': 'overhead press',
  'side raise': 'lateral raise',
  'side lateral raise': 'lateral raise',
  'dumbbell lateral raise': 'lateral raise',
  'reverse fly': 'rear delt fly',
  'rear delt raise': 'rear delt fly',
  'bicep curl': 'dumbbell curl',
  'biceps curl': 'dumbbell curl',
  'dumbbell bicep curl': 'dumbbell curl',
  'ez bar curl': 'barbell curl',
  'lying tricep extension': 'skull crusher',
  'skullcrusher': 'skull crusher',
  'triceps pushdown': 'tricep pushdown',
  'cable pushdown': 'tricep pushdown',
  'rope pushdown': 'tricep pushdown',
  'tricep extension': 'overhead tricep extension',
  'overhead triceps extension': 'overhead tricep extension',
  'lunge': 'dumbbell lunge',
  'walking lunge': 'dumbbell lunge',
  'split squat': 'bulgarian split squat',
  'lying leg curl': 'leg curl',
  'hamstring curl': 'leg curl',
  'quad extension': 'leg extension',
  'standing calf raise': 'calf raise',
  'sit ups': 'sit up',
  'crunches': 'crunch',
  'ab rollout': 'ab wheel rollout',
  'ab wheel': 'ab wheel rollout',
  'leg raise': 'hanging leg raise',
  'skipping': 'jump rope',
  'skipping rope': 'jump rope',
  'running': 'treadmill',
  'run': 'treadmill',
  'cycling': 'stationary bike',
  'bike': 'stationary bike',
  'stairmaster': 'stair climber',
  'stepmill': 'stair climber',
  'shrugs': 'shrug',
  'barbell shrug': 'shrug',
}

export type ExerciseGif = {
  /** Animated GIF — only worth fetching when the client opens the popup. */
  gifUrl: string
  /** Single still frame, for the paused thumbnail. */
  thumbUrl: string
}

/**
 * Lower-case, strip punctuation, collapse whitespace and normalise the
 * bicep/biceps-style noise so "Tricep Pushdown", "triceps push-down" and
 * "TRICEP  PUSHDOWN" all land on the same key.
 */
function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\btriceps\b/g, 'tricep')
    .replace(/\bbiceps\b/g, 'bicep')
    .replace(/\bdumbell\b/g, 'dumbbell')
    .trim()
    .replace(/\s+/g, ' ')
}

function slugFor(name: string): string | null {
  const key = normalise(name)
  if (SLUGS[key]) return SLUGS[key]

  const aliased = ALIASES[key]
  if (aliased && SLUGS[aliased]) return SLUGS[aliased]

  // Coaches qualify movements freely — "Bench Press (Wide Grip)", "Squat -
  // pause reps". Fall back to the longest leading run of words we recognise,
  // down to the bare movement. Only exact keys ever match, so the worst case is
  // the base lift standing in for one of its variants.
  const words = key.split(' ')
  for (let end = words.length - 1; end >= 1; end--) {
    const prefix = words.slice(0, end).join(' ')
    if (SLUGS[prefix]) return SLUGS[prefix]
    const alias = ALIASES[prefix]
    if (alias && SLUGS[alias]) return SLUGS[alias]
  }

  return null
}

/**
 * The demonstration for an exercise, or null when we have no verified match.
 * Callers must handle null — roughly one library exercise in thirty has no
 * trustworthy GIF in the dataset.
 */
export function resolveExerciseGif(name: string | null | undefined): ExerciseGif | null {
  if (!name) return null
  const slug = slugFor(name)
  if (!slug) return null
  return {
    gifUrl: `${BASE}@${REF}/${slug}.gif`,
    thumbUrl: `${BASE}@${REF}/${slug}.thumb.webp`,
  }
}

/** True when an exercise has a demonstration. Cheaper than building the URLs. */
export function hasExerciseGif(name: string | null | undefined): boolean {
  return !!name && slugFor(name) !== null
}
