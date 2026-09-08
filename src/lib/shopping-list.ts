/**
 * Shopping-list domain logic — turning a run of daily meal plans into one
 * consolidated list of things to buy.
 *
 * Deliberately free of server and React concerns: the server action that walks
 * the client's plans and the sheet that renders the result both import from
 * here, so the categories, the staple flags and the unit maths stay identical
 * on both sides.
 */

export type ShoppingCategory =
  | 'produce'
  | 'protein'
  | 'dairy'
  | 'grains'
  | 'pantry'
  | 'other'

/** Aisle order — roughly the order a supermarket is walked. */
export const CATEGORY_ORDER: ShoppingCategory[] = [
  'produce',
  'protein',
  'dairy',
  'grains',
  'pantry',
  'other',
]

export type ShoppingItem = {
  /**
   * Stable identity across regenerations — the same food at the same unit keeps
   * its key whether the client asks for 3 days or 10, so exclusions they set
   * once ("I always have olive oil") survive a change of period.
   */
  key: string
  /** The coach's own wording, kept verbatim so `tx()` can still translate it. */
  foodName: string
  unit: string
  quantity: number
  category: ShoppingCategory
  /**
   * Bought in bulk and rarely per-shop — oil, spices, protein powder. Pre-ticked
   * in the exclude step so the client isn't hunting for them one by one.
   */
  staple: boolean
}

export type ShoppingSourceFood = {
  foodName: string
  quantity: number
  unit: string
}

/** One day of the range, already resolved to the foods its plan prescribes. */
export type ShoppingSourceDay = {
  date: string
  foods: ShoppingSourceFood[]
}

export type ShoppingList = {
  startDate: string
  endDate: string
  days: number
  /** Days in the range that actually resolved to a plan with food on it. */
  coveredDays: number
  items: ShoppingItem[]
}

// ── Classification ──────────────────────────────────────────────────────────
// Coaches type food names by hand, in English or Bulgarian, so this matches on
// word prefixes rather than on an exact dictionary hit. Prefixes (not plain
// substrings) matter: "boiled" contains "oil", and "Bell Pepper" contains
// "pepper". Rules are evaluated in order and the first match wins, so the
// specific produce and protein rules sit ahead of the broad pantry ones.

type Rule = {
  category: ShoppingCategory
  staple?: boolean
  /** Single tokens match a word prefix; anything with a space matches a phrase. */
  match: string[]
}

const RULES: Rule[] = [
  {
    category: 'protein',
    match: [
      'chicken', 'пилеш', 'turkey', 'пуеш', 'beef', 'говежд', 'кайма', 'mince',
      'pork', 'свинск', 'lamb', 'агнеш', 'veal', 'телеш', 'steak', 'стек',
      'fish', 'риба', 'salmon', 'сьомга', 'tuna', 'скумрия', 'mackerel',
      'shrimp', 'скарид', 'seafood', 'морски дарове', 'риба тон',
      'egg', 'яйц', 'яйца', 'белтъц', 'жълтъц', 'ham', 'шунка', 'bacon', 'бекон',
      'tofu', 'тофу', 'tempeh', 'темпе', 'liver', 'дроб',
    ],
  },
  {
    category: 'produce',
    match: [
      // Fruit
      'apple', 'ябълк', 'banana', 'банан', 'orange', 'портокал', 'berry',
      'berries', 'боровинк', 'ягод', 'малин', 'къпин', 'горски плодове',
      'grape', 'грозде', 'peach', 'прасков', 'pear', 'круш', 'plum', 'слив',
      'melon', 'диня', 'пъпеш', 'kiwi', 'киви', 'mango', 'манго',
      'pineapple', 'ананас', 'lemon', 'лимон', 'lime', 'лайм', 'cherry', 'череш',
      'apricot', 'кайси', 'fruit', 'плод',
      // Veg
      'avocado', 'авокадо', 'spinach', 'спанак', 'broccoli', 'броколи',
      'vegetable', 'зеленчу', 'green beans', 'зелен фасул', 'carrot', 'морков',
      'cucumber', 'краставиц', 'tomato', 'домат', 'lettuce', 'марул',
      'bell pepper', 'чушк', 'onion', 'лук', 'garlic', 'чесън',
      'zucchini', 'тиквич', 'asparagus', 'аспержи', 'mushroom', 'гъб',
      'cabbage', 'зеле', 'cauliflower', 'карфиол', 'celery', 'целина',
      'salad', 'салат', 'beet', 'цвекло', 'radish', 'ряпа',
      'potato', 'картоф', 'pumpkin', 'тикв', 'peas', 'грах', 'corn', 'царевиц',
      'olives', 'маслин', 'herbs', 'магданоз', 'копър', 'босилек',
    ],
  },
  {
    category: 'dairy',
    match: [
      'milk', 'мляко', 'yogurt', 'yoghurt', 'кисело мляко', 'кефир', 'kefir',
      'cheese', 'сирене', 'кашкавал', 'извара', 'cottage', 'feta', 'фета',
      'mozzarella', 'моцарела', 'parmesan', 'пармезан', 'cream', 'сметана',
      'ayran', 'айрян',
    ],
  },
  {
    category: 'grains',
    match: [
      'oat', 'овес', 'rice', 'ориз', 'bread', 'хляб', 'pasta', 'паста',
      'spaghetti', 'спагети', 'noodle', 'юфка', 'quinoa', 'киноа',
      'granola', 'гранола', 'cereal', 'зърнен', 'мюсли', 'muesli',
      'couscous', 'кускус', 'bulgur', 'булгур', 'tortilla', 'тортил',
      'wrap', 'гризини', 'crackers', 'сухар', 'pita', 'пита', 'bagel',
      'barley', 'ечемик', 'buckwheat', 'елда',
    ],
  },
  {
    // Bulk buys — the things this feature's exclude step exists for.
    category: 'pantry',
    staple: true,
    match: [
      'oil', 'зехтин', 'олио', 'vinegar', 'оцет', 'salt', 'сол',
      'pepper', 'пипер', 'spice', 'подправк', 'cinnamon', 'канела',
      'sugar', 'захар', 'sweetener', 'подсладител', 'stevia', 'стеви',
      'flour', 'брашно', 'honey', 'мед', 'syrup', 'сироп', 'jam', 'конфитюр',
      'sauce', 'сос', 'ketchup', 'кетчуп', 'mustard', 'горчица',
      'mayo', 'майонез', 'coffee', 'кафе', 'tea', 'чай', 'cocoa', 'какао',
      'peanut butter', 'фъстъчено масло', 'almond butter', 'бадемово масло',
      'tahini', 'тахан', 'butter', 'масло', 'baking', 'сода', 'yeast', 'мая',
      'stock', 'бульон', 'protein powder', 'протеин на прах', 'протеинов прах',
      'whey', 'суроватъч', 'creatine', 'креатин', 'supplement', 'добавк',
      'vitamin', 'витамин',
    ],
  },
  {
    category: 'pantry',
    match: [
      'nuts', 'ядки', 'almond', 'бадем', 'walnut', 'орех', 'cashew', 'кашу',
      'peanut', 'фъстъц', 'seed', 'семе', 'семки', 'chia', 'чиа',
      'lentil', 'лещ', 'chickpea', 'нахут', 'bean', 'боб', 'фасул',
      'canned', 'консерв', 'chocolate', 'шоколад', 'bar', 'бар',
      'raisin', 'стафид', 'date', 'фурм', 'dried', 'сушен', 'hummus', 'хумус',
    ],
  },
]

/** Words of a food name, lowercased — punctuation and digits stripped out. */
function wordsOf(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
}

function ruleMatches(rule: Rule, lowerName: string, words: string[]): boolean {
  for (const token of rule.match) {
    if (token.includes(' ')) {
      if (lowerName.includes(token)) return true
    } else if (words.some((w) => w.startsWith(token))) {
      return true
    }
  }
  return false
}

export function classifyFood(name: string): { category: ShoppingCategory; staple: boolean } {
  const lower = name.toLowerCase().normalize('NFC')
  const words = wordsOf(name)
  for (const rule of RULES) {
    if (ruleMatches(rule, lower, words)) {
      return { category: rule.category, staple: rule.staple ?? false }
    }
  }
  return { category: 'other', staple: false }
}

// ── Aggregation ─────────────────────────────────────────────────────────────

function itemKey(name: string, unit: string): string {
  return `${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}`
}

/**
 * Folds every day's foods into one line per food + unit. Two entries only merge
 * when their units match, so "2 eggs" never silently adds itself to "100 g of
 * eggs" — they stay as two honest lines.
 */
export function aggregateShoppingItems(days: ShoppingSourceDay[]): ShoppingItem[] {
  const byKey = new Map<string, ShoppingItem>()

  for (const day of days) {
    for (const food of day.foods) {
      const name = food.foodName?.trim()
      if (!name) continue
      const quantity = Number(food.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) continue
      const unit = (food.unit ?? '').trim()

      const key = itemKey(name, unit)
      const existing = byKey.get(key)
      if (existing) {
        existing.quantity += quantity
      } else {
        const { category, staple } = classifyFood(name)
        byKey.set(key, { key, foodName: name, unit, quantity, category, staple })
      }
    }
  }

  return [...byKey.values()]
    .map((item) => ({ ...item, quantity: Math.round(item.quantity * 100) / 100 }))
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        a.foodName.localeCompare(b.foodName)
    )
}

// ── Amounts ─────────────────────────────────────────────────────────────────

const GRAM_UNITS = new Set(['g', 'gr', 'gram', 'grams', 'г', 'гр', 'грам', 'грама'])
const ML_UNITS = new Set(['ml', 'mls', 'milliliter', 'millilitre', 'мл', 'милилитра'])

function trimNumber(n: number, maxDecimals: number): string {
  const factor = 10 ** maxDecimals
  const rounded = Math.round(n * factor) / factor
  // `String` already drops trailing zeros — 1.50 → "1.5", 2.00 → "2".
  return String(rounded)
}

/**
 * A week of chicken is "1.4 kg", not "1400 g". Scales grams and millilitres up
 * at 1000 and keeps the unit in the language the coach wrote it in.
 */
export function formatAmount(quantity: number, unit: string): string {
  const u = unit.trim().toLowerCase()
  if (GRAM_UNITS.has(u) && quantity >= 1000) {
    return `${trimNumber(quantity / 1000, 2)} ${u.startsWith('г') ? 'кг' : 'kg'}`
  }
  if (ML_UNITS.has(u) && quantity >= 1000) {
    return `${trimNumber(quantity / 1000, 2)} ${u.startsWith('м') ? 'л' : 'l'}`
  }
  const value = trimNumber(quantity, 1)
  return unit ? `${value} ${unit}` : value
}
