#!/usr/bin/env node
// «Дифф PR только из документов» для ci.yml: тяжёлые джобы пропускают шаги, а сами
// остаются зелёными (обязательные проверки ruleset отчитываются тем же именем).
// Шаг пишет docs_only=true|false в $GITHUB_OUTPUT. Любая неясность — false (полный круг).
// База — первый родитель merge-коммита PR (нужен fetch-depth ≥ 2); вне pull_request — всегда false.
import { appendFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

// Читают тесты живых документов — их правка идёт полным кругом.
const READ_BY_TESTS = [/^docs\/design\//, /^docs\/RUNBOOKS\.md$/];
const DOC_PATHS = [/^docs\//, /^[^/]+\.md$/, /^\.claude\/rules\//];

export const isDocPath = (p) =>
  DOC_PATHS.some((re) => re.test(p)) && !READ_BY_TESTS.some((re) => re.test(p));

/** Пустой дифф — не «только документы»: ничего не решаем, гоним всё. */
export const isDocsOnly = (files) => files.length > 0 && files.every(isDocPath);

function changedFiles() {
  const out = execFileSync(
    'git',
    ['diff', '--name-only', '--no-renames', '-z', 'HEAD^1', 'HEAD'],
    { encoding: 'utf8' },
  );
  return out.split('\0').filter(Boolean);
}

function main() {
  let docsOnly = false;
  if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
    try {
      docsOnly = isDocsOnly(changedFiles());
    } catch {
      docsOnly = false;
    }
  }
  console.log(`docs_only=${docsOnly}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `docs_only=${docsOnly}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
