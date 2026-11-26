// Разбор stdout `npm audit --json` для обёртки scripts/npm-audit.mjs
// (регресс #814). Отдельно от движка обёртки (таймер, повторы, группа
// процессов) — правило №10: список форм ответа растёт, движок не должен.
//
// Формы ответа npm 10 (все — записанные фикстуры test/fixtures/recorded/
// npm-audit-*.json, правило №23):
//   отчёт — @npmcli/arborist audit-report.js toJSON: metadata.vulnerabilities
//     с числовыми счётчиками по уровням;
//   ошибка реестра — lib/utils/audit-error.js: message/statusCode/body/error
//     (400 «endpoint is being retired» и т. п.) — повтор может помочь;
//   ошибка npm — lib/utils/error-message.js: {error: {code, summary, detail}}.
//     Сетевые коды (ECONNRESET, ETIMEDOUT…) — повтор может помочь; локальные
//     (LOCAL_ERRORS: нет lock-файла, битый JSON) — повтор не поможет,
//     перезапуск джобы тоже.
// Всё прочее (JSON без metadata, не-JSON, пусто) — «отчёта нет»: зелёным
// непроверенное не бывает, но и «уязвимостью» оно не названо.

export const GATING = ['high', 'critical'];

/** Коды npm, при которых ответ реестра не нужен и повтор ничего не даст. */
export const LOCAL_ERRORS = new Set([
  'ENOLOCK', // нет package-lock.json
  'EJSONPARSE', // битый package.json / lock
  'EUSAGE', // неверные флаги — сломана сама обёртка
  'ENOENT', // каталога нет
  'ENOTDIR',
]);

/**
 * clean | vulnerable — отчёт есть; none — отчёта нет, повторить;
 * broken — npm не может проверить этот каталог, повторять бессмысленно.
 */
export function classify(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { kind: 'none', reason: text.trim() ? 'ответ npm — не JSON' : 'npm ничего не вывел' };
  }
  const code = data?.error?.code;
  if (typeof code === 'string' && LOCAL_ERRORS.has(code)) {
    return { kind: 'broken', reason: `${code} — ${data.error.summary || 'без текста'}` };
  }
  if (data?.error || data?.statusCode) {
    const head = data.message ?? [code, data.error?.summary].filter(Boolean).join(' — ');
    const body = data.body?.message ? ` (${data.body.message})` : '';
    return { kind: 'none', reason: `реестр ответил ошибкой: ${head || 'без текста'}${body}` };
  }
  const counts = data?.metadata?.vulnerabilities;
  if (!counts || !GATING.every((s) => Number.isInteger(counts[s]))) {
    return { kind: 'none', reason: 'в ответе нет metadata.vulnerabilities' };
  }
  if (!GATING.some((s) => counts[s] > 0)) return { kind: 'clean', counts };
  const packages = Object.values(data.vulnerabilities ?? {})
    .filter((v) => GATING.includes(v?.severity));
  return { kind: 'vulnerable', counts, packages };
}

/** «lodash — high, затронуто <=4.17.23» + заголовки advisory уровня high+. */
export function describe(v) {
  const fix = v.fixAvailable?.version ? `; исправлено в ${v.fixAvailable.version}` : '';
  const lines = [`  ${v.name} — ${v.severity}, затронуто ${v.range}${fix}`];
  for (const via of v.via ?? []) {
    if (typeof via === 'string') lines.push(`    · через ${via}`);
    else if (GATING.includes(via.severity)) lines.push(`    · ${via.title} (${via.url})`);
  }
  return lines.join('\n');
}
