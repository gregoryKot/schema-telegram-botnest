// Лог для фоновых fire-and-forget запросов (persist-only тогглы, аналитика,
// каши без UI-последствий провала). Раньше такие места были .catch(() => {})
// — провал был не виден вообще никак (scripts/check-silent-catch.mjs,
// CLAUDE.md п.7/№8: девять продовых багов из-за этого паттерна).
export const logErr = (label: string) => (e: unknown) =>
  console.error(label, e);
