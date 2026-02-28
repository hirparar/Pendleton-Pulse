/** Trims text, returns null if empty, clamps length. */
export function cleanText(input: unknown, max = 500) {
  const s = String(input ?? "").trim();
  if (!s.length) return null;
  return s.slice(0, max);
}

/** Required string (throws), clamps length. */
export function cleanRequired(input: unknown, max = 180, label = "Field") {
  const s = String(input ?? "").trim();
  if (!s.length) throw new Error(`${label} is required`);
  return s.slice(0, max);
}

/** Required integer (throws), truncates, enforces bounds. */
export function cleanInt(input: unknown, opts: { min: number; max: number; label: string }) {
  const n = Number(input);
  if (!Number.isFinite(n)) throw new Error(`${opts.label} must be a number`);
  const v = Math.trunc(n);
  if (v < opts.min || v > opts.max) {
    throw new Error(`${opts.label} must be between ${opts.min} and ${opts.max}`);
  }
  return v;
}

/** Optional integer; returns null if empty/invalid/out of range. */
export function cleanOptionalInt(input: unknown, min = 0, max = 60) {
  if (input === null || input === undefined || input === "") return null;
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

/** Parses a date (throws if invalid). */
export function cleanDate(input: unknown, label: string) {
  const d = new Date(String(input ?? ""));
  if (Number.isNaN(d.getTime())) throw new Error(`${label} must be a valid date`);
  return d;
}

/** Parses a datetime (throws if invalid). Alias of cleanDate but clearer intent. */
export function cleanDateTime(input: unknown, label: string) {
  const s = String(input ?? "").trim();
  if (!s.length) throw new Error(`${label} is required`);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`${label} must be a valid datetime`);
  return d;
}

/**
 * Cleans an array of strings: trims, removes empties, clamps per-item length,
 * de-dupes case-insensitively (keeps first casing), clamps count.
 */
export function cleanStringArray(input: unknown, maxItems = 25, maxLen = 60) {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((x) => String(x ?? "").trim())
    .filter((x) => x.length > 0)
    .map((x) => x.slice(0, maxLen));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of cleaned) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}