#!/usr/bin/env node
// Гейт «спек есть, а прогона нет»: каждый test/**/*.e2e-spec.ts обязан
// гоняться хотя бы одним шагом `jest --config ./test/jest-e2e.json` в
// .github/workflows/*.yml (фейк — джоба `backend`, живая база — `migrations`).
//
// Откуда: аудит 2026-10-11 нашёл два спека (exercise-delete-ownership,
// max-auth), которые лежали в test/ и числились защитой, но не запускались ни
// в одной джобе. Список спеков в ci.yml ведётся руками, а `jest` с
// несколькими паттернами молча пропускает тот, что ни с чем не совпал, —
// поэтому спек, добавленный в test/ без строки в ci.yml (или переименованный
// файл при старой строке), оставался зелёным навсегда.
//
// Семантика jest: аргумент — регэксп по пути, `test/app-ownership` покрывает
// и `test/app-ownership-sweep-2.e2e-spec.ts`. Гейт считает токен покрывающим,
// если путь спека его СОДЕРЖИТ (точки — буквально, этого достаточно).
//
// Красное:
//   (а) спек, которого не покрывает ни один токен — сирота;
//   (б) токен в CI, которому не соответствует ни один файл — та же дыра с
//       другой стороны (переименовали спек, строка осталась и ничего не гоняет).
//
// Что НЕ считается: YAML-комментарии (`# test/app-auth.e2e-spec.ts` в
// пояснении к шагу) и шаги без jest-e2e (`test/perf/seed.ts` и т.п.).
//
// Бейслайна нет намеренно: законных сирот сегодня нет, а запись «не гоняем,
// потому что…» была бы ровно тем замалчиванием, от которого гейт защищает
// (правило №15). Спек, который нельзя гонять в CI, удаляется или чинится.
import { readFileSync, readdirSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.jest-cache']);

/** Убирает YAML-комментарии: `#` в начале строки или после пробела. */
export function stripYamlComments(text) {
  return text.replace(/(^|\s)#[^\n]*/g, '$1');
}

/** Шаги workflow: каждый начинается строкой `- ` (name/run/uses). */
function splitSteps(text) {
  return text.split(/\n\s*-\s+(?=[A-Za-z_-]+:)/);
}

/** Токены `test/...` из команд jest-e2e одного шага. */
function e2eTokensOfStep(step) {
  const tokens = [];
  const runMatch = step.match(/(^|\n)\s*(?:-\s+)?run:\s*([>|])?[-+]?[ \t]*(\n|\S)/);
  if (!runMatch) return tokens;
  // `>` складывает строки в одну команду, `|` и однострочный run — построчно.
  const folded = runMatch[2] === '>';
  const body = step.slice(runMatch.index + runMatch[0].length - runMatch[3].length);
  const re = /(?:jest-e2e\.json|test:e2e)/g;
  let m;
  while ((m = re.exec(body))) {
    let rest = body.slice(m.index + m[0].length);
    if (!folded) rest = rest.split('\n')[0];
    rest = rest.split(/&&|\|\||;/)[0];
    // Следующий ключ шага (`env:`) в свёрнутом блоке — уже не команда.
    rest = rest.split(/\n\s*[\w-]+:\s/)[0];
    for (const t of rest.match(/(?<![\w./-])test\/[\w./-]+/g) ?? []) tokens.push(t);
  }
  return tokens;
}

/** Токены-аргументы jest-e2e из текста одного workflow. */
export function e2eTokens(workflowText) {
  return splitSteps(stripYamlComments(workflowText)).flatMap(e2eTokensOfStep);
}

function listSpecs(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) listSpecs(join(dir, e.name), out);
    } else if (e.name.endsWith('.e2e-spec.ts')) {
      out.push(relative(ROOT, join(dir, e.name)).split('\\').join('/'));
    }
  }
  return out.sort();
}

/** Чистая сверка: { orphans, deadTokens } по списку спеков и токенам CI. */
export function compare(specs, tokens) {
  const uniq = [...new Set(tokens)];
  return {
    orphans: specs.filter((s) => !uniq.some((t) => s.includes(t))),
    deadTokens: uniq.filter((t) => !specs.some((s) => s.includes(t))),
  };
}

function main() {
  const wfDir = join(ROOT, '.github', 'workflows');
  const tokens = readdirSync(wfDir)
    .filter((f) => /\.ya?ml$/.test(f))
    .flatMap((f) => e2eTokens(readFileSync(join(wfDir, f), 'utf8')));
  const specs = listSpecs(join(ROOT, 'test'));
  const { orphans, deadTokens } = compare(specs, tokens);

  if (orphans.length || deadTokens.length) {
    console.error('❌ Гейт «каждый e2e-спек гоняется в CI»:\n');
    for (const s of orphans) console.error(`${s}: ни одна джоба CI его не запускает`);
    for (const t of deadTokens) console.error(`${t}: в CI указан путь, которому не соответствует ни один e2e-спек`);
    console.error(
      '\nСпек, которого нет в ci.yml, ничего не защищает: jest с несколькими\n' +
        'паттернами молча пропускает несовпавший, и красным он не станет никогда.\n' +
        'Добавь спек в джобу `backend` (фейковая Prisma) и, если ему нужна живая\n' +
        'база, в джобу `migrations`; для переименованного — поправь строку в ci.yml.\n' +
        'Бейслайна нет: спек, который нельзя гонять, чинят или удаляют.',
    );
    process.exit(1);
  }

  console.log(
    `✓ гейт e2e в CI: ${specs.length} спеков, все гоняются (${new Set(tokens).size} путей в джобах).`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
