/**
 * Meal-plan PDF export.
 *
 * Renders one or more meal plans (training / rest / overall) as a single
 * document that mirrors the meal-plan editor: macro stat cards, one card per
 * meal with its option tabs, and the food table with per-100g-derived macros.
 */

import type { UserOptions } from 'jspdf-autotable'
import {
  C, CONTENT_W, MARGIN,
  addPage, card, createDoc, drawDisclaimer, drawFooters, drawHeader, drawNoteBlock,
  drawStatCards, ensureSpace, fileName, fontOf, formatToday, paintBackground,
  paragraph, pill, round1, sectionTitle, setFont, text,
  type Ctx, type Stat,
} from './doc'

export type PdfFood = {
  name: string
  quantity: number
  unit: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

export type PdfMealOption = { label: string; foods: PdfFood[] }
export type PdfMeal = { name: string; options: PdfMealOption[] }

export type PdfMealPlan = {
  name: string
  planType: 'training' | 'rest' | 'overall'
  notes?: string | null
  recommendations?: string | null
  meals: PdfMeal[]
}

export type MealPlanPdfInput = {
  /** Workspace / brand name shown in the eyebrow and footer. */
  brand: string
  clientName?: string | null
  plans: PdfMealPlan[]
  /** Overrides the computed document title. */
  title?: string
}

const PLAN_META: Record<PdfMealPlan['planType'], { label: string; color: string }> = {
  training: { label: 'Training Day', color: C.accent },
  rest:     { label: 'Rest Day',     color: C.purple },
  overall:  { label: 'All Days',     color: C.green },
}

// Column widths add up to CONTENT_W (515.28pt); Food takes the remainder.
// The macro columns are wide enough for their header labels not to wrap.
const COL = { qty: 74, cal: 46, protein: 56, carbs: 50, fat: 46 }
const COL_FOOD = CONTENT_W - (COL.qty + COL.cal + COL.protein + COL.carbs + COL.fat)
const NUM_PAD = { top: 7, bottom: 7, left: 6, right: 6 }

type Totals = { calories: number; proteinG: number; carbsG: number; fatG: number }

function totalsOf(foods: PdfFood[]): Totals {
  return foods.reduce<Totals>(
    (acc, f) => ({
      calories: acc.calories + f.calories,
      proteinG: acc.proteinG + f.proteinG,
      carbsG:   acc.carbsG + f.carbsG,
      fatG:     acc.fatG + f.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )
}

/** Daily totals use the first option of every meal — same rule as the editor. */
function planTotals(plan: PdfMealPlan): Totals {
  return plan.meals.reduce<Totals>(
    (acc, meal) => {
      const t = totalsOf(meal.options[0]?.foods ?? [])
      return {
        calories: acc.calories + t.calories,
        proteinG: acc.proteinG + t.proteinG,
        carbsG:   acc.carbsG + t.carbsG,
        fatG:     acc.fatG + t.fatG,
      }
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )
}

function quantityLabel(f: PdfFood): string {
  return `${round1(f.quantity)} ${f.unit}`
}

function macroStats(t: Totals): Stat[] {
  return [
    { label: 'Calories', value: String(Math.round(t.calories)), unit: 'kcal', color: C.text },
    { label: 'Protein',  value: String(Math.round(t.proteinG)), unit: 'g',    color: C.protein },
    { label: 'Carbs',    value: String(Math.round(t.carbsG)),   unit: 'g',    color: C.carbs },
    { label: 'Fat',      value: String(Math.round(t.fatG)),     unit: 'g',    color: C.fat },
  ]
}

// ─── Meal card ───────────────────────────────────────────────────────────────

function drawMealHeader(ctx: Ctx, meal: PdfMeal, index: number): void {
  const h = 32
  // Keep the header with at least the table head + one row.
  ensureSpace(ctx, h + 56)
  card(ctx, MARGIN, ctx.y, CONTENT_W, h, { fill: C.surface2, stroke: C.line, radius: 8 })

  setFont(ctx, 'bold', 8, C.faint)
  text(ctx, String(index + 1).padStart(2, '0'), MARGIN + 14, ctx.y + 20.5)

  setFont(ctx, 'bold', 11.5, C.text)
  text(ctx, meal.name, MARGIN + 34, ctx.y + 20.5, { maxWidth: 220 })

  const t = totalsOf(meal.options[0]?.foods ?? [])
  const right = MARGIN + CONTENT_W - 14
  const macros: Array<{ label: string; color: string }> = [
    { label: `F ${Math.round(t.fatG)}`,     color: C.fat },
    { label: `C ${Math.round(t.carbsG)}`,   color: C.carbs },
    { label: `P ${Math.round(t.proteinG)}`, color: C.protein },
  ]
  let cursorX = right
  for (const m of macros) {
    setFont(ctx, 'bold', 9, m.color)
    text(ctx, m.label, cursorX, ctx.y + 20.5, { align: 'right' })
    cursorX -= ctx.doc.getTextWidth(m.label) + 14
  }
  setFont(ctx, 'regular', 8, C.hint)
  text(ctx, 'kcal', cursorX, ctx.y + 20.5, { align: 'right' })
  cursorX -= ctx.doc.getTextWidth('kcal') + 4
  setFont(ctx, 'bold', 11, C.text)
  text(ctx, String(Math.round(t.calories)), cursorX, ctx.y + 20.5, { align: 'right' })

  ctx.y += h + 6
}

function drawOptionLabel(ctx: Ctx, option: PdfMealOption, isDefault: boolean): void {
  ensureSpace(ctx, 20 + 46)
  const label = `OPTION ${option.label}`
  const w = pill(ctx, label, MARGIN + 2, ctx.y, isDefault ? C.accent : C.hint)
  if (isDefault) {
    setFont(ctx, 'regular', 7.5, C.faint)
    text(ctx, 'counted in daily totals', MARGIN + 2 + w + 8, ctx.y + 10.5)
  }
  const t = totalsOf(option.foods)
  setFont(ctx, 'regular', 8, C.hint)
  text(
    ctx,
    `${Math.round(t.calories)} kcal · P ${Math.round(t.proteinG)} · C ${Math.round(t.carbsG)} · F ${Math.round(t.fatG)}`,
    MARGIN + CONTENT_W - 2,
    ctx.y + 10.5,
    { align: 'right' },
  )
  ctx.y += 20
}

function foodTableOptions(ctx: Ctx, option: PdfMealOption): UserOptions {
  const t = totalsOf(option.foods)
  const body = option.foods.length > 0
    ? option.foods.map((f) => [
        f.name,
        quantityLabel(f),
        String(Math.round(f.calories)),
        String(round1(f.proteinG)),
        String(round1(f.carbsG)),
        String(round1(f.fatG)),
      ])
    : [['No foods in this option', '', '', '', '', '']]

  return {
    startY: ctx.y,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN + 16 },
    tableWidth: CONTENT_W,
    theme: 'plain',
    head: [['FOOD', 'QUANTITY', 'CAL', 'PROTEIN', 'CARBS', 'FAT']],
    body,
    foot: option.foods.length > 0
      ? [[
          'Total',
          '',
          String(Math.round(t.calories)),
          String(round1(t.proteinG)),
          String(round1(t.carbsG)),
          String(round1(t.fatG)),
        ]]
      : undefined,
    showHead: 'everyPage',
    // Without this the totals row repeats on every page a long meal spans.
    showFoot: 'lastPage',
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
    footStyles: {
      font: fontOf('bold').family,
      fontStyle: 'bold',
      fontSize: 9,
      textColor: C.text,
      fillColor: C.surface2,
      lineWidth: { top: 0, left: 0, right: 0, bottom: 0 },
    },
    columnStyles: {
      0: { cellWidth: COL_FOOD },
      1: { cellWidth: COL.qty, textColor: C.muted },
      2: { cellWidth: COL.cal, halign: 'center', textColor: C.muted, cellPadding: NUM_PAD },
      3: { cellWidth: COL.protein, halign: 'center', textColor: C.protein, font: fontOf('semibold').family, cellPadding: NUM_PAD },
      4: { cellWidth: COL.carbs, halign: 'center', textColor: C.carbs, font: fontOf('semibold').family, cellPadding: NUM_PAD },
      5: { cellWidth: COL.fat, halign: 'center', textColor: C.fat, font: fontOf('semibold').family, cellPadding: NUM_PAD },
    },
    didParseCell: (data) => {
      // Column tints belong to the macro columns only — headers stay muted and
      // the foot row re-applies them on top of the darker total bar.
      if (data.section === 'head') {
        if (data.column.index === 3) data.cell.styles.textColor = C.protein
        if (data.column.index === 4) data.cell.styles.textColor = C.carbs
        if (data.column.index === 5) data.cell.styles.textColor = C.fat
        data.cell.styles.font = fontOf('bold').family
      }
      if (data.section === 'foot') {
        if (data.column.index === 0) data.cell.styles.textColor = C.hint
        if (data.column.index === 3) data.cell.styles.textColor = C.protein
        if (data.column.index === 4) data.cell.styles.textColor = C.carbs
        if (data.column.index === 5) data.cell.styles.textColor = C.fat
      }
      if (data.section === 'body' && option.foods.length === 0) {
        data.cell.styles.textColor = C.faint
        data.cell.styles.fontSize = 8.5
      }
    },
  }
}

// ─── Plan section ────────────────────────────────────────────────────────────

async function drawPlan(ctx: Ctx, plan: PdfMealPlan, withSectionTitle: boolean): Promise<void> {
  const { default: autoTable } = await import('jspdf-autotable')
  const meta = PLAN_META[plan.planType]

  if (withSectionTitle) {
    sectionTitle(ctx, plan.name, meta.color, meta.label)
  }

  drawStatCards(ctx, macroStats(planTotals(plan)))

  const hasOptions = plan.meals.some((m) => m.options.length > 1)
  if (hasOptions) {
    ctx.y -= 12
    setFont(ctx, 'regular', 8, C.faint)
    text(ctx, 'Daily totals count Option A of every meal. Alternatives are listed underneath.', MARGIN, ctx.y)
    ctx.y += 20
  }

  if (plan.meals.length === 0) {
    setFont(ctx, 'regular', 10, C.hint)
    text(ctx, 'This plan has no meals yet.', MARGIN, ctx.y)
    ctx.y += 24
  }

  plan.meals.forEach((meal, i) => {
    drawMealHeader(ctx, meal, i)
    meal.options.forEach((option, oi) => {
      if (meal.options.length > 1) drawOptionLabel(ctx, option, oi === 0)
      autoTable(ctx.doc, {
        ...foodTableOptions(ctx, option),
        // autoTable adds its own pages; each needs the dark background painted
        // before any table content lands on it.
        willDrawPage: () => paintBackground(ctx),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctx.y = (ctx.doc as any).lastAutoTable.finalY + (oi === meal.options.length - 1 ? 16 : 10)
    })
  })

  if (plan.notes?.trim()) {
    drawNoteBlock(ctx, 'Notes for client', plan.notes.trim(), meta.color)
  }
  if (plan.recommendations?.trim()) {
    drawNoteBlock(ctx, 'Recommendations', plan.recommendations.trim(), C.blue)
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function buildMealPlanPdf(input: MealPlanPdfInput) {
  const plans = input.plans
  const multi = plans.length > 1
  const generatedOn = formatToday()

  const title =
    input.title ??
    (multi ? (input.clientName ?? 'Meal plans') : (plans[0]?.name ?? 'Meal plan'))

  const ctx = await createDoc(title)

  const meta: string[] = []
  if (input.clientName && input.clientName !== title) meta.push(input.clientName)
  if (!multi && plans[0]) meta.push(PLAN_META[plans[0].planType].label)
  if (multi) meta.push(`${plans.length} plans`)
  meta.push(generatedOn)

  drawHeader(ctx, {
    eyebrow: input.brand,
    kind: 'Meal Plan',
    title,
    meta,
    accent: C.accent,
  })

  for (let i = 0; i < plans.length; i++) {
    if (i > 0) addPage(ctx)
    await drawPlan(ctx, plans[i], multi)
  }

  if (plans.length === 0) {
    setFont(ctx, 'regular', 10, C.hint)
    paragraph(ctx, 'No meal plan is assigned to this client yet.', MARGIN, ctx.y, CONTENT_W, 14)
    ctx.y += 24
  }

  drawDisclaimer(
    ctx,
    'Macros are calculated from the per-100 g values stored for each food. Swap options freely within a meal — they are built to match.',
  )
  drawFooters(ctx, input.brand, generatedOn)
  return ctx.doc
}

export async function downloadMealPlanPdf(input: MealPlanPdfInput): Promise<void> {
  const doc = await buildMealPlanPdf(input)
  const name = input.plans.length === 1 && !input.clientName
    ? fileName(['Meal-Plan', input.plans[0].name])
    : fileName(['Meal-Plan', input.clientName ?? input.plans[0]?.name])
  doc.save(name)
}
