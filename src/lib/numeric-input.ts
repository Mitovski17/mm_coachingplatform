/**
 * Sanitizes raw text from a decimal numeric-entry input: strips non-digit/non-separator
 * characters, treats "," as an alternate decimal point (many iOS keyboards show a
 * comma instead of a period depending on the device's region), keeps only the first
 * decimal point, and drops a leading zero once another digit follows it (so clearing
 * a field and typing "1" yields "1", not "01").
 */
export function normalizeDecimalInput(raw: string): string {
  let v = raw.replace(/[^0-9.,]/g, '').replace(/,/g, '.')
  const firstDot = v.indexOf('.')
  if (firstDot !== -1) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '')
  if (/^0[0-9]/.test(v)) v = v.replace(/^0+/, '')
  return v
}

/** Same as normalizeDecimalInput but for whole-number-only fields (e.g. reps, rest seconds). */
export function normalizeIntegerInput(raw: string): string {
  let v = raw.replace(/[^0-9]/g, '')
  if (/^0[0-9]/.test(v)) v = v.replace(/^0+/, '')
  return v
}
