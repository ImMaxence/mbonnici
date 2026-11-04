/**
 * Matching a technology name (a skill of the profile, or the ?tech= filter) against the stack of
 * a project. Names are written freely in the back office ("Node.js / Express", "Docker & Compose",
 * "Angular 22"), so both sides are split into normalised tokens:
 *   "Node.js / Express" → nodejs, express      "Angular 22" → angular22 (and angular)
 */
export function normTech(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9+#]/g, '');
}

export function techTokens(name: string): string[] {
  const out = new Set<string>();
  for (const part of name.split(/\s*(?:\/|&|,|·|\(|\)|\bet\b|\band\b)\s*/i)) {
    const n = normTech(part);
    if (!n) continue;
    out.add(n);
    // a trailing version number does not change the technology ("angular22", "python3")
    const base = n.replace(/\d+$/, '');
    if (base.length > 1 && base !== n) out.add(base);
  }
  return [...out];
}

/** Does a project stack use this technology? */
export function usesTech(stack: readonly string[], tech: string): boolean {
  const wanted = new Set(techTokens(tech));
  if (!wanted.size) return false;
  return stack.some((s) => techTokens(s).some((t) => wanted.has(t)));
}
