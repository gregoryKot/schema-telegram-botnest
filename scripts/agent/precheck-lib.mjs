// Чистые функции для scripts/agent/precheck.mjs: разбор ci.yml, список
// пропускаемых гейтов, форматирование вывода. Ничего не запускает и не
// трогает диск — поэтому проверяется спеком src/test-support/agent-precheck.spec.ts
// без git и без подпроцессов.

// Гейты, которые precheck НЕ запускает: им нужна сборка, прогон покрытия, БД
// или полная установка eslint — быстрой проверкой по файлам они не бывают,
// их проверит CI. Имя — файл гейта (аргументы не важны: `--package webapp` и
// `--package shared` пропускаются вместе). Причина — одна строка. Список не
// «исключения из проверки», а честная граница инструмента: спек
// agent-precheck.spec.ts требует, чтобы каждый ключ стоял в ci.yml, а любой
// гейт вне списка запускался.
export const NEEDS_BUILD = {
  'check-coverage-ratchet.mjs':
    'сам гоняет весь jest с покрытием — минуты и сборка',
  'check-frontend-coverage-ratchet.mjs':
    'сам гоняет vitest с покрытием, нужен npm ci во фронтендах',
  'check-bundle-size-ratchet.mjs':
    'меряет готовые webapp/dist и мини-апп dist — нужна сборка фронтенда',
  'check-eslint-ratchet.mjs':
    'запускает eslint по всему репозиторию — нужны node_modules четырёх пакетов и prisma generate; локально: node scripts/check-eslint-ratchet.mjs --changed',
  'check-query-plans.mjs':
    'судит .perf/plans.json, который пишет замер EXPLAIN на живом Postgres (джоба perf)',
};

// Шаг ci.yml вида `- run: node scripts/<имя>.mjs [аргументы]` (или `run:` без
// дефиса в шаге с `name:`). Хвостовой YAML-комментарий (` # …`) отрезается.
// Аргументы — только простые токены: `&&`, пайп, подстановка оболочки шагом не
// считаются, иначе precheck запустил бы не то, что запускает CI (спек сверяет,
// что каждая команда `node scripts/…` из ci.yml разобрана).
const STEP_RE =
  /^\s*(?:-\s+)?run:\s+node\s+scripts\/([A-Za-z0-9._-]+\.mjs)((?:\s+[A-Za-z0-9_./=:@,-]+)*)\s*(?:\s#.*)?$/;
const JOB_RE = /^ {2}([A-Za-z0-9_-]+):\s*(?:#.*)?$/;
const TOP_KEY_RE = /^[A-Za-z0-9_-]+:/;

/**
 * Гейты из текста ci.yml в порядке файла, без повторов (повтор — та же команда
 * целиком, с аргументами). Для каждого — джоба, где он встретился первым.
 * @returns {{job: string, script: string, args: string[], command: string}[]}
 */
export function gatesFromWorkflow(yamlText) {
  const gates = [];
  const seen = new Set();
  let inJobs = false;
  let job = null;
  for (const raw of yamlText.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (TOP_KEY_RE.test(line)) {
      inJobs = /^jobs:\s*(?:#.*)?$/.test(line);
      job = null;
      continue;
    }
    if (!inJobs) continue;
    const jobMatch = JOB_RE.exec(line);
    if (jobMatch) {
      job = jobMatch[1];
      continue;
    }
    const step = STEP_RE.exec(line);
    if (!step || job === null) continue;
    const args = step[2].trim() ? step[2].trim().split(/\s+/) : [];
    const command = ['node', `scripts/${step[1]}`, ...args].join(' ');
    if (seen.has(command)) continue;
    seen.add(command);
    gates.push({ job, script: step[1], args, command });
  }
  return gates;
}

/** Делит гейты на «запускаем» и «пропускаем» (с причиной из NEEDS_BUILD). */
export function splitGates(gates, needsBuild = NEEDS_BUILD) {
  const run = [];
  const skipped = [];
  for (const gate of gates) {
    const reason = needsBuild[gate.script];
    if (reason) skipped.push({ ...gate, reason });
    else run.push(gate);
  }
  return { run, skipped };
}

const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
const MAX_LINE = 240;

/** Последние `count` непустых строк вывода, без цветов, длинные — обрезаны. */
export function tailLines(output, count = 15) {
  const lines = output
    .replace(ANSI_RE, '')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.length > 0)
    .map((l) => (l.length > MAX_LINE ? `${l.slice(0, MAX_LINE)}…` : l));
  return lines.slice(-count);
}

/** Блок о красном гейте: заголовок и хвост вывода с отступом. */
export function formatFailure(gate, output, note = '') {
  const head = `✗ ${gate.job}: ${gate.command}${note ? ` (${note})` : ''}`;
  const body = tailLines(output).map((l) => `    ${l}`);
  return [head, ...body].join('\n');
}

/** Итоговые строки: одна зелёная или блоки красных и последняя сводка. */
export function formatSummary({ total, skipped, failures }) {
  if (failures.length === 0) {
    return (
      `✓ precheck: ${total} гейтов зелёные ` +
      `(пропущено ${skipped}: нужны сборка/БД — их проверит CI)`
    );
  }
  return [
    ...failures,
    `✗ precheck: ${failures.length} из ${total} красные`,
  ].join('\n');
}

/** Вывод `--list`: что запустится и что пропущено (с причиной). */
export function formatList(run, skipped) {
  return [
    `запускаются (${run.length}):`,
    ...run.map((g) => `  ${g.job.padEnd(8)} ${g.command}`),
    `пропускаются (${skipped.length}):`,
    ...skipped.map((g) => `  ${g.job.padEnd(8)} ${g.command} — ${g.reason}`),
  ].join('\n');
}
