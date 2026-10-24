#!/usr/bin/env node
// Гейт планов запросов.
//
// Производительность — единственная зона, которую аудиты проверяли ЧТЕНИЕМ
// СХЕМЫ, а не замером: `docs/archive/PROJECT_AUDIT_ADDENDUM.md` §3 (находка
// D-4: «приемлемо сейчас, это первый кандидат в узкое место») и
// `docs/security/AUDIT_2026-08-12.md` (M2/M3/H3/H4 — perf-находки). Ни один
// план запроса никто не снимал: индекс `Rating.date` по M2 добавили по
// рассуждению, а не по EXPLAIN.
//
// Разовый замер закрывает вопрос один раз; следующая просадка опять будет
// невидимой — правило без механизма не работает (CLAUDE.md, преамбула).
// Поэтому замер приезжает гейтом: джоба `perf` сеет синтетику горизонта роста,
// прогоняет горячие пути РЕАЛЬНЫМИ сервисами, снимает EXPLAIN (ANALYZE,
// BUFFERS) с того SQL, который ушёл в базу через драйвер (test/perf/), и этот
// скрипт судит результат.
//
// Гейт умышленно НЕ смотрит на миллисекунды как на главную метрику: на раннере
// GitHub время скачет в разы, и гейт по времени отключили бы через неделю как
// ложно-красный (правило №15 п.4). Главные метрики — свойства плана:
//   1) Seq Scan по БОЛЬШОЙ таблице, выбрасывающий почти всё прочитанное, —
//      это и есть отсутствующий индекс. Seq Scan сам по себе законен: запрос
//      без WHERE (`count(DISTINCT "userId") FROM "UserPractice"`) читает
//      таблицу целиком, и индекс ему не поможет. Поэтому условие — не «есть
//      Seq Scan», а «прочитал много, отдал мало».
//   2) Повторный полный проход (loops > 1) по большой таблице — N+1 внутри
//      Nested Loop.
//   3) Страницы (shared hit + read) — храповик: детерминированы при
//      фиксированной синтетике, в отличие от времени.
// Время остаётся грубым потолком-страховкой на катастрофу (msCeiling),
// и ставится руками, а не `--update`: «разумный порог» — решение человека.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'query-plan-baseline.json');
const DEFAULT_REPORT = join(ROOT, '.perf', 'plans.json');

// Таблица меньше этого размера сканируется последовательно правильно: индекс
// на ней планировщик законно игнорирует, и гейт, краснеющий на таком плане,
// учил бы обходить себя (правило №15).
export const BIG_TABLE_ROWS = 50_000;
// Доля прочитанного и выброшенного фильтром, после которой Seq Scan — диагноз.
// 0.9 — не «красивое число»: при меньшем отборе индекс часто проигрывает
// последовательному чтению, и требовать его было бы вредным советом.
export const DISCARD_RATIO = 0.9;
// Запас храповика по страницам. Нужен не «на всякий случай»: план может
// переключиться между index scan и bitmap heap scan от шага статистики, это
// даёт единицы процентов. 25% ловит кратный рост и не ловит шум.
export const BLOCKS_HEADROOM = 0.25;
// Замер на пустой базе зелёный всегда — и это самый тихий способ сломать
// защиту (гейт молчит, потому что мерить было нечего). Отчёт обязан быть снят
// на синтетике: нижние границы заведомо меньше профиля сидера (test/perf/seed.ts),
// это порог «не пустая база», а не сверка объёма.
export const REQUIRED_VOLUME = {
  Rating: 1_000_000,
  AnalyticsEvent: 1_000_000,
  TherapyRelation: 5_000,
};
const REASON_MIN = 20;
const REASON_RED_FLAGS = ['legacy', 'todo', 'потом', 'позже'];

const num = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n));

/** Разбор отчёта замера. Нет файла — это не «нечего проверять», а красный гейт. */
export function loadReport(path) {
  if (!existsSync(path)) {
    return {
      error:
        `отчёта замера нет: ${path}\n` +
        '  Сначала сидер и замер (джоба `perf` в ci.yml делает это за тебя):\n' +
        '    npx ts-node --compiler-options \'{"module":"commonjs"}\' test/perf/seed.ts\n' +
        '    npx ts-node --compiler-options \'{"module":"commonjs"}\' test/perf/run-plans.ts',
    };
  }
  try {
    return { report: JSON.parse(readFileSync(path, 'utf8')) };
  } catch {
    return { error: `отчёт замера не разбирается как JSON: ${path}` };
  }
}

function checkVolume(report) {
  const rows = report.tableRows ?? {};
  return Object.entries(REQUIRED_VOLUME)
    .filter(([table, min]) => (rows[table] ?? 0) < min)
    .map(
      ([table, min]) =>
        `замер снят не на синтетике: в «${table}» ${num(rows[table] ?? 0)} строк, ` +
        `нужно хотя бы ${num(min)} — прогони test/perf/seed.ts`,
    );
}

function badReason(reason) {
  if (typeof reason !== 'string' || reason.trim().length < REASON_MIN) {
    return `причина короче ${REASON_MIN} символов`;
  }
  const flag = REASON_RED_FLAGS.find((w) => reason.toLowerCase().includes(w));
  return flag ? `причина-отписка («${flag}»)` : null;
}

/** Нарушения плана одного сценария + ключи seqScanAllowed, которые сработали. */
function checkPlans(scenario, tableRows, allowed) {
  const problems = [];
  const used = new Set();
  for (const stmt of scenario.statements ?? []) {
    for (const hit of stmt.seqScans ?? []) {
      const size = tableRows[hit.table] ?? 0;
      if (size < BIG_TABLE_ROWS) continue;
      const read = hit.kept + hit.removed;
      const discard = read > 0 ? hit.removed / read : 0;
      // У параллельного скана `loops` — это воркеры, поделившие ОДИН проход, а
      // не повторные проходы: распараллеленное законное чтение повтором не
      // считается (иначе гейт ругался бы на оптимизацию планировщика).
      const repeated = hit.loops > 1 && !hit.parallel;
      if (!repeated && discard < DISCARD_RATIO) continue;

      const key = `${scenario.name}:${hit.table}`;
      const reason = allowed[key];
      if (reason !== undefined) {
        used.add(key);
        const bad = badReason(reason);
        if (bad) problems.push(`исключение ${key}: ${bad}`);
        continue;
      }
      const sql = String(stmt.sql).replace(/\s+/g, ' ').slice(0, 160);
      problems.push(
        repeated
          ? `Seq Scan по «${hit.table}» (${num(size)} строк) повторён ${hit.loops} раз — ` +
              `полный проход внутри цикла:\n      ${sql}`
          : `Seq Scan по «${hit.table}» (${num(size)} строк) прочитал ${num(read)} строк ` +
              `и выбросил ${num(hit.removed)} (${Math.round(discard * 100)}%) — нет индекса под этот фильтр:\n      ${sql}`,
      );
    }
  }
  return { problems, used };
}

function checkBudget(scenario, budget) {
  const problems = [];
  if (typeof budget.msCeiling !== 'number') {
    problems.push(
      `нет потолка времени (msCeiling) — поставь его руками: ` +
        `сценарий уложился в ${num(scenario.ms)} мс, потолок берётся с запасом на шум раннера`,
    );
  } else if (scenario.ms > budget.msCeiling) {
    problems.push(
      `${num(scenario.ms)} мс — выше потолка ${num(budget.msCeiling)} мс`,
    );
  }
  if (typeof budget.blocks !== 'number') {
    problems.push('нет планки по страницам (blocks) — зафиксируй её: --update');
  } else {
    const limit = Math.ceil(budget.blocks * (1 + BLOCKS_HEADROOM));
    if (scenario.blocks > limit) {
      problems.push(
        `${num(scenario.blocks)} страниц против планки ${num(budget.blocks)} ` +
          `(+${Math.round((scenario.blocks / budget.blocks - 1) * 100)}%, допуск ${Math.round(BLOCKS_HEADROOM * 100)}%) — ` +
          'запрос стал читать заметно больше; если рост законен, объясни его в теле коммита и зафиксируй: --update',
      );
    }
  }
  return problems;
}

/** Чистая проверка: отчёт + бейслайн → список нарушений (пусто = зелено). */
export function checkQueryPlans(report, baseline) {
  const problems = checkVolume(report);
  const tableRows = report.tableRows ?? {};
  const budgets = baseline.scenarios ?? {};
  const allowed = baseline.seqScanAllowed ?? {};
  const measured = new Set();
  const usedAllows = new Set();

  for (const scenario of report.scenarios ?? []) {
    measured.add(scenario.name);
    const budget = budgets[scenario.name];
    if (!budget) {
      problems.push(
        `сценарий «${scenario.name}» не заведён в бейслайне: ${num(scenario.ms)} мс, ` +
          `${num(scenario.blocks)} страниц — зафиксируй планку (--update) и поставь msCeiling`,
      );
      continue;
    }
    const plans = checkPlans(scenario, tableRows, allowed);
    for (const key of plans.used) usedAllows.add(key);
    for (const p of [...plans.problems, ...checkBudget(scenario, budget)]) {
      problems.push(`${scenario.name}: ${p}`);
    }
  }

  // Протухшая запись роняет гейт так же, как нарушение (правило №16): запись,
  // которой больше нечего гасить, — это не уборка, а сигнал «сверься, что
  // произошло». Иначе исключение, выданное под старый план, молча прикрывало
  // бы новый.
  for (const name of Object.keys(budgets)) {
    if (!measured.has(name)) {
      problems.push(
        `сценарий «${name}» есть в бейслайне, но не в замере — переименован или удалён?`,
      );
    }
  }
  for (const key of Object.keys(allowed)) {
    if (!usedAllows.has(key)) {
      problems.push(
        `исключение «${key}» больше ничего не гасит: план исправился (убери запись) ` +
          'или сценарий переименован',
      );
    }
  }
  return problems;
}

function update(report, baseline) {
  const scenarios = { ...(baseline.scenarios ?? {}) };
  for (const s of report.scenarios ?? []) {
    scenarios[s.name] = { ...scenarios[s.name], blocks: s.blocks };
  }
  const sorted = {};
  for (const key of Object.keys(scenarios).sort()) sorted[key] = scenarios[key];
  return { ...baseline, scenarios: sorted };
}

function main() {
  const reportPath = process.argv.includes('--report')
    ? resolve(process.argv[process.argv.indexOf('--report') + 1])
    : DEFAULT_REPORT;
  const { report, error } = loadReport(reportPath);
  if (error) {
    console.error(`❌ Гейт планов запросов: ${error}`);
    process.exit(1);
  }
  const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : {};

  if (process.argv.includes('--update')) {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(update(report, baseline), null, 2) + '\n',
    );
    console.log(
      'Планки по страницам зафиксированы. msCeiling не трогается: порог времени — решение человека.',
    );
    return;
  }

  if (process.argv.includes('--verbose')) {
    for (const s of report.scenarios ?? []) {
      console.log(`\n${s.name}: ${num(s.ms)} мс, ${num(s.blocks)} страниц`);
      for (const st of s.statements ?? []) {
        console.log(
          `  ${num(st.blocks)} стр ×${st.calls} — ${String(st.sql).replace(/\s+/g, ' ').slice(0, 120)}`,
        );
      }
    }
  }

  const problems = checkQueryPlans(report, baseline);
  if (problems.length > 0) {
    console.error('❌ Гейт планов запросов:\n');
    for (const p of problems) console.error(`  • ${p}`);
    console.error(
      '\nЧинится индексом (обычный CREATE INDEX в миграции, не CONCURRENTLY — ' +
        'см. CLAUDE.md «Миграции БД») или запросом. Исключение — только с честной ' +
        'причиной в scripts/query-plan-baseline.json и контрольным образцом в тесте гейта.',
    );
    process.exit(1);
  }
  const counts = (report.scenarios ?? [])
    .map((s) => `${s.name}: ${num(s.ms)} мс / ${num(s.blocks)} стр`)
    .join(', ');
  console.log(`✅ Планы запросов в норме (${counts}).`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
