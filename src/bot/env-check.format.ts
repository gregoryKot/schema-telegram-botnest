// Блок «Настройки: переменные» для /stats (правило №8: метрика, которой нет
// в отчёте, — невидима). Чистый форматтер поверх src/infra/env-check.ts —
// щит, инциденты 2026-09-15 (пустой ADMIN_EMAIL молчал) и 2026-09-16
// (GOOGLE_REDIRECT_URI вёл на чужой хост). Язык простой: «не задано: …», а
// не «missing: [...]».
import { formatEnvCheckLines } from '../infra/env-check-boot-log';
import { EnvCheckResult } from '../infra/env-check';
import { ENV_REGISTRY } from '../infra/env-registry.entries';

export function formatEnvCheckReport(result: EnvCheckResult): string {
  const title = '🧩 <b>Настройки: переменные</b>';
  const lines = formatEnvCheckLines(result);

  if (lines.length === 0) {
    return `${title}: все ${ENV_REGISTRY.length} переменных в порядке.`;
  }

  return [title, ...lines.map((l) => `• ${l}`)].join('\n');
}
