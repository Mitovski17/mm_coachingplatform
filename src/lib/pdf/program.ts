/**
 * Training-program PDF export.
 *
 * Mirrors the program editor: a day-by-day schedule (weekly or cyclic) where
 * each training day becomes a card with its exercise table. Exercises whose
 * sets differ from one another get an expanded per-set breakdown so a client
 * can read the plan straight off the page.
 *
 * The same day cards back the workout-template export at the bottom of this
 * file — a template is just the schedule without the weekday / cycle framing.
 */

import type { UserOptions } from 'jspdf-autotable'
import {
  C, CONTENT_W, MARGIN,
  card, createDoc, drawDisclaimer, drawFooters, drawHeader, drawNoteBlock,
  drawStatCards, ensureSpace, fileName, fontOf, formatToday, paintBackground,
  paragraph, setFont, text,
  type Ctx,
} from './doc'

export type PdfSet = {
  setNumber: number
  targetReps: number
  targetWeight?: string | null
  rpe?: string | null
  notes?: string | null
}

export type PdfExercise = {
  name: string
  muscleGroup: string
  targetSets: number
  targetReps: string
  restSeconds: number
  notes?: string | null
  sets: PdfSet[]
}

export type PdfWorkoutDay = {
  /** e.g. "Monday" or "Day 1". */
  title: string
  /** Template day label, e.g. "Upper A". */
  label?: string | null
  /** Source template name. */
  templateName?: string | null
  notes?: string | null
  exercises: PdfExercise[]
  isRest: boolean
}

export type ProgramPdfInput = {
  brand: string
  clientName?: string | null
  programName: string
  scheduleType: 'weekly' | 'cyclic'
  cycleStartDate?: string | null
  isActive?: boolean
  days: PdfWorkoutDay[]
  notes?: string | null
}

/**
 * A saved workout template — the reusable building block a program is assembled
 * from. Same day cards as a program, minus the weekday / cycle framing.
 */
export type WorkoutTemplatePdfInput = {
  brand: string
  templateName: string
  days: PdfWorkoutDay[]
  notes?: string | null
}

const COL = { sets: 44, reps: 62, load: 84, rest: 62 }
const COL_EX = CONTENT_W - (COL.sets + COL.reps + COL.load + COL.rest)
const NUM_PAD = { top: 7, bottom: 7, left: 6, right: 6 }

function restLabel(seconds: number): string {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

/** True when every set shares the same reps / load / RPE — then one row is enough. */
function setsAreUniform(ex: PdfExercise): boolean {
  if (ex.sets.length <= 1) return true
  const key = (s: PdfSet) => `${s.targetReps}|${s.targetWeight ?? ''}|${s.rpe ?? ''}`
  const first = key(ex.sets[0])
  return ex.sets.every((s) => key(s) === first)
}

/** Summary cell — a range when the sets ramp, a single number when they don't. */
function repsLabel(ex: PdfExercise): string {
  if (ex.sets.length === 0) return ex.targetReps || '—'
  if (setsAreUniform(ex)) return `${ex.sets[0].targetReps}`
  const reps = ex.sets.map((s) => s.targetReps)
  const lo = Math.min(...reps)
  const hi = Math.max(...reps)
  return lo === hi ? `${lo}` : `${hi}–${lo}`
}

function loadLabel(ex: PdfExercise): string {
  const weights = ex.sets.map((s) => (s.targetWeight ?? '').trim()).filter(Boolean)
  const rpes = ex.sets.map((s) => (s.rpe ?? '').trim()).filter(Boolean)
  if (weights.length > 0) {
    const uniform = weights.every((w) => w === weights[0])
    return uniform ? weights[0] : `${weights[0]} → ${weights[weights.length - 1]}`
  }
  if (rpes.length > 0) {
    const uniform = rpes.every((r) => r === rpes[0])
    return uniform ? `RPE ${rpes[0]}` : `RPE ${rpes[0]} → ${rpes[rpes.length - 1]}`
  }
  return '—'
}

/**
 * Per-set breakdown for ramping exercises. Squeezing four different loads into
 * one cell wraps badly, so the detail gets its own full-width sub-row.
 */
function setBreakdown(ex: PdfExercise): string | null {
  if (setsAreUniform(ex) || ex.sets.length === 0) return null
  return ex.sets
    .map((s) => {
      const bits = [`${s.targetReps} reps`]
      const w = (s.targetWeight ?? '').trim()
      const rpe = (s.rpe ?? '').trim()
      if (w) bits.push(w)
      if (rpe) bits.push(`RPE ${rpe}`)
      return `Set ${s.setNumber}: ${bits.join(' · ')}`
    })
    .join('    ')
}

function setCount(ex: PdfExercise): number {
  return ex.sets.length || ex.targetSets
}

// ─── Day card ────────────────────────────────────────────────────────────────

function drawDayHeader(ctx: Ctx, day: PdfWorkoutDay, index: number): void {
  const h = 36
  ensureSpace(ctx, h + (day.isRest ? 8 : 56))

  const accent = day.isRest ? C.hint : C.blue
  card(ctx, MARGIN, ctx.y, CONTENT_W, h, {
    fill: day.isRest ? C.base : C.surface2,
    stroke: day.isRest ? C.line : C.line,
    radius: 8,
  })
  ctx.doc.setFillColor(accent)
  ctx.doc.rect(MARGIN + 1, ctx.y + 8, 2.5, h - 16, 'F')

  setFont(ctx, 'bold', 8, C.faint)
  text(ctx, String(index + 1).padStart(2, '0'), MARGIN + 14, ctx.y + 22.5)

  setFont(ctx, 'bold', 11.5, day.isRest ? C.hint : C.text)
  text(ctx, day.title, MARGIN + 34, ctx.y + 22.5, { maxWidth: 150 })

  const detail = day.isRest
    ? 'Rest day'
    : [day.label, day.templateName].filter(Boolean).join('  ·  ')
  if (detail) {
    setFont(ctx, 'regular', 9.5, day.isRest ? C.faint : C.muted)
    text(ctx, detail, MARGIN + 190, ctx.y + 22.5, { maxWidth: 220 })
  }

  if (!day.isRest) {
    const exCount = day.exercises.length
    const setTotal = day.exercises.reduce((n, e) => n + setCount(e), 0)
    setFont(ctx, 'regular', 8.5, C.hint)
    text(
      ctx,
      `${exCount} exercise${exCount === 1 ? '' : 's'}  ·  ${setTotal} sets`,
      MARGIN + CONTENT_W - 14,
      ctx.y + 22.5,
      { align: 'right' },
    )
  }

  ctx.y += h + (day.isRest ? 8 : 6)
}

function exerciseTableOptions(ctx: Ctx, day: PdfWorkoutDay): UserOptions {
  const body: Array<Array<string>> = []
  const subRows = new Set<number>()

  for (const ex of day.exercises) {
    body.push([
      ex.name,
      String(setCount(ex)),
      repsLabel(ex),
      loadLabel(ex),
      restLabel(ex.restSeconds),
    ])
    const detail = [setBreakdown(ex), (ex.notes ?? '').trim() || null]
      .filter(Boolean)
      .join('\n')
    if (detail) {
      subRows.add(body.length)
      // The arrow keeps the sub-row readable as a continuation even when a page
      // break separates it from the exercise it belongs to. U+2192 is inside
      // the Inter subset shipped in public/fonts.
      body.push([`→  ${detail}`, '', '', '', ''])
    }
  }

  if (body.length === 0) body.push(['No exercises in this day', '', '', '', ''])

  return {
    startY: ctx.y,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN + 16 },
    tableWidth: CONTENT_W,
    theme: 'plain',
    head: [['EXERCISE', 'SETS', 'REPS', 'LOAD / RPE', 'REST']],
    body,
    showHead: 'everyPage',
    styles: {
      font: fontOf('regular').family,
      fontStyle: 'normal',
      fontSize: 9,
      textColor: C.textSoft,
      fillColor: C.surface1,
      lineColor: C.line,
      lineWidth: { top: 0, left: 0, right: 0, bottom: 0.7 },
      cellPadding: { top: 7, bottom: 7, left: 12, right: 12 },
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      font: fontOf('bold').family,
      fontStyle: 'bold',
      fontSize: 6.8,
      textColor: C.hint,
      fillColor: C.base,
      cellPadding: { top: 6, bottom: 6, left: 12, right: 12 },
      lineWidth: { top: 0, left: 0, right: 0, bottom: 0.7 },
      lineColor: C.line,
    },
    columnStyles: {
      0: { cellWidth: COL_EX },
      1: { cellWidth: COL.sets, halign: 'center', font: fontOf('semibold').family, textColor: C.text, cellPadding: NUM_PAD },
      2: { cellWidth: COL.reps, halign: 'center', font: fontOf('semibold').family, textColor: C.blue, cellPadding: NUM_PAD },
      3: { cellWidth: COL.load, halign: 'center', textColor: C.muted, cellPadding: NUM_PAD },
      4: { cellWidth: COL.rest, halign: 'center', textColor: C.hint, cellPadding: NUM_PAD },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 2) {
        data.cell.styles.textColor = C.blue
      }
      // Set breakdowns and coach notes render as a full-width sub-row.
      if (data.section === 'body' && subRows.has(data.row.index)) {
        data.cell.styles.fillColor = C.base
        data.cell.styles.textColor = C.hint
        data.cell.styles.fontSize = 8
        data.cell.styles.cellPadding = { top: 5, bottom: 7, left: 12, right: 12 }
        if (data.column.index === 0) data.cell.colSpan = 5
      }
      if (data.section === 'body' && day.exercises.length === 0) {
        data.cell.styles.textColor = C.faint
        data.cell.styles.fontSize = 8.5
      }
    },
  }
}

/** Day cards + exercise tables — shared by the program and template documents. */
async function drawDays(ctx: Ctx, days: PdfWorkoutDay[]): Promise<void> {
  const { default: autoTable } = await import('jspdf-autotable')

  days.forEach((day, i) => {
    drawDayHeader(ctx, day, i)
    if (day.isRest) return

    autoTable(ctx.doc, {
      ...exerciseTableOptions(ctx, day),
      willDrawPage: () => paintBackground(ctx),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.y = (ctx.doc as any).lastAutoTable.finalY + 16

    const dayNotes = (day.notes ?? '').trim()
    if (dayNotes) {
      drawNoteBlock(ctx, `${day.title} — notes`, dayNotes, C.blue)
    }
  })
}

const DISCLAIMER =
  'Rest values are the target pause between sets. Where an exercise ramps, the per-set breakdown is listed directly under it.'

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function buildProgramPdf(input: ProgramPdfInput) {
  const generatedOn = formatToday()
  const ctx = await createDoc(input.programName)

  const trainingDays = input.days.filter((d) => !d.isRest)
  const totalExercises = trainingDays.reduce((n, d) => n + d.exercises.length, 0)
  const totalSets = trainingDays.reduce(
    (n, d) => n + d.exercises.reduce((m, e) => m + setCount(e), 0),
    0,
  )

  const meta: string[] = []
  if (input.clientName) meta.push(input.clientName)
  meta.push(input.scheduleType === 'cyclic'
    ? `${input.days.length}-day cycle`
    : 'Weekly schedule')
  if (input.scheduleType === 'cyclic' && input.cycleStartDate) {
    meta.push(`Starts ${input.cycleStartDate}`)
  }
  meta.push(generatedOn)

  drawHeader(ctx, {
    eyebrow: input.brand,
    kind: 'Training Plan',
    title: input.programName || 'Training plan',
    meta,
    accent: C.blue,
  })

  drawStatCards(ctx, [
    { label: 'Training days', value: String(trainingDays.length), unit: input.scheduleType === 'cyclic' ? '/ cycle' : '/ week', color: C.text },
    { label: 'Rest days', value: String(input.days.length - trainingDays.length), unit: '', color: C.hint },
    { label: 'Exercises', value: String(totalExercises), unit: 'total', color: C.blue },
    { label: 'Working sets', value: String(totalSets), unit: 'total', color: C.green },
  ])

  if (input.days.length === 0) {
    setFont(ctx, 'regular', 10, C.hint)
    paragraph(ctx, 'This program has no days scheduled yet.', MARGIN, ctx.y, CONTENT_W, 14)
    ctx.y += 24
  }

  await drawDays(ctx, input.days)

  if (input.notes?.trim()) {
    drawNoteBlock(ctx, 'Program notes', input.notes.trim(), C.blue)
  }

  drawDisclaimer(ctx, DISCLAIMER)

  drawFooters(ctx, input.brand, generatedOn)
  return ctx.doc
}

export async function downloadProgramPdf(input: ProgramPdfInput): Promise<void> {
  const doc = await buildProgramPdf(input)
  doc.save(fileName(['Training-Plan', input.clientName ?? input.programName]))
}

// ─── Workout template ────────────────────────────────────────────────────────

export async function buildWorkoutTemplatePdf(input: WorkoutTemplatePdfInput) {
  const generatedOn = formatToday()
  const ctx = await createDoc(input.templateName)

  const totalExercises = input.days.reduce((n, d) => n + d.exercises.length, 0)
  const totalSets = input.days.reduce(
    (n, d) => n + d.exercises.reduce((m, e) => m + setCount(e), 0),
    0,
  )

  drawHeader(ctx, {
    eyebrow: input.brand,
    kind: 'Workout Template',
    title: input.templateName || 'Workout template',
    meta: [
      `${input.days.length} ${input.days.length === 1 ? 'day' : 'days'}`,
      generatedOn,
    ],
    accent: C.blue,
  })

  drawStatCards(ctx, [
    { label: 'Days', value: String(input.days.length), unit: 'total', color: C.text },
    { label: 'Exercises', value: String(totalExercises), unit: 'total', color: C.blue },
    { label: 'Working sets', value: String(totalSets), unit: 'total', color: C.green },
  ])

  if (input.days.length === 0) {
    setFont(ctx, 'regular', 10, C.hint)
    paragraph(ctx, 'This template has no days yet.', MARGIN, ctx.y, CONTENT_W, 14)
    ctx.y += 24
  }

  await drawDays(ctx, input.days)

  if (input.notes?.trim()) {
    drawNoteBlock(ctx, 'Template notes', input.notes.trim(), C.blue)
  }

  drawDisclaimer(ctx, DISCLAIMER)

  drawFooters(ctx, input.brand, generatedOn)
  return ctx.doc
}

export async function downloadWorkoutTemplatePdf(input: WorkoutTemplatePdfInput): Promise<void> {
  const doc = await buildWorkoutTemplatePdf(input)
  doc.save(fileName(['Workout-Template', input.templateName]))
}
