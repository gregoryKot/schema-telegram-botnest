// Санитизация meta для события data_export (правило №7/№10) — вынесена из
// analytics-meta.sanitize.ts отдельным модулем (тот же приём, что и у
// sanitize-login/sanitize-quick-actions/sanitize-screens).
//
// Событие в реальности пишет только эндпоинт выгрузки данных (GET
// /api/account/export, право на доступ по 152-ФЗ/GDPR) с реальным userId —
// эта ветка на клиентский путь POST /api/event попасть не должна. Whitelist
// здесь — defence in depth (тот же приём, что у auth_success): даже если
// кто-то дёрнет эндпоинт руками, meta ограничена двумя целыми числами с
// потолком, никакого свободного текста/PII.
export function sanitizeDataExportMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const tables = meta.tables;
  const rows = meta.rows;
  if (
    typeof tables === 'number' &&
    Number.isInteger(tables) &&
    tables >= 0 &&
    typeof rows === 'number' &&
    Number.isInteger(rows) &&
    rows >= 0
  ) {
    return { tables: Math.min(tables, 200), rows: Math.min(rows, 1_000_000) };
  }
  return undefined;
}
