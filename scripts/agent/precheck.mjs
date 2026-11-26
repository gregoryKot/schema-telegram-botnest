#!/usr/bin/env node
// Быстрая проверка перед пушем: все гейты CI, которым хватает файлов, — одной
// командой, в чистом дереве, с выводом только про красное.
//
//   node scripts/agent/precheck.mjs          # прогнать гейты
//   node scripts/agent/precheck.mjs --list   # что запустится и что пропущено
//
// Зачем. Петля «пуш → ~10 минут CI → красный быстрый гейт → читать лог →
// чинить → пуш» — самое дорогое в проекте, а быстрые гейты (`node
// scripts/check-*.mjs`) читают только файлы и отвечают за секунды. Но локально
// они врут: прогон в рабочем дереве видит то, чего нет в чистом чекауте CI, —
// неотслеживаемый журнал `.claude/state/tool-log.jsonl`, сборки, dist. Путь из
// .gitignore в карте кода прошёл локально и уронил `checks` (2026-10-21).
//
// Что делает.
//  1. Список гейтов берёт из .github/workflows/ci.yml (шаги `run: node
//     scripts/….mjs [арг]`, по порядку файла, без повторов) — не из копии:
//     новый гейт в CI попадает сюда сам. Разбор — gatesFromWorkflow().
//  2. Пропускает гейты, которым нужны сборка, прогон покрытия, БД или полный
//     eslint (NEEDS_BUILD в precheck-lib.mjs, причина у каждого) — их проверит CI.
//  3. Поднимает `git worktree` на HEAD и переносит в него всё, что отличается
//     в рабочем дереве (правки, новые файлы, удаления, в том числе уже
//     застейдженные), затем `git add -A` в нём (только индекс, без коммита):
//     гейты на `git ls-files` видят то, что окажется в коммите. Игнорируемые
//     файлы не переносятся — как в CI. Логика — precheck-tree.mjs.
//  4. Гоняет гейты по очереди в этом дереве; в конце worktree удаляется всегда
//     (и при сбое, и по Ctrl-C).
//
// Вывод короткий: все зелёные — одна строка; красный — заголовок и последние
// 15 строк его вывода. Код выхода: 0 — зелёно, 1 — есть красные, 2 — сам
// инструмент не смог отработать (git, диск).
import { spawn } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  formatFailure,
  formatList,
  formatSummary,
  gatesFromWorkflow,
  splitGates,
} from './precheck-lib.mjs';
import { createCleanTree, removeTree } from './precheck-tree.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const WORKFLOW = join(ROOT, '.github', 'workflows', 'ci.yml');
const GATE_TIMEOUT_MS = 180_000;
let currentChild = null;

/** Запускает один гейт в `tree`; stdout и stderr — в общий файл (порядок строк цел). */
function runGate(tree, gate, logPath) {
  return new Promise((resolve) => {
    const fd = openSync(logPath, 'w');
    let timedOut = false;
    let done = false;
    const child = spawn(process.execPath, [join('scripts', gate.script), ...gate.args], {
      cwd: tree,
      stdio: ['ignore', fd, fd],
    });
    currentChild = child;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, GATE_TIMEOUT_MS);
    const finish = (code, note) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      closeSync(fd);
      resolve({ code, note, output: readFileSync(logPath, 'utf8') });
    };
    child.on('error', (err) => finish(1, String(err.message)));
    child.on('close', (code) =>
      finish(timedOut ? 1 : code ?? 1, timedOut ? `таймаут ${GATE_TIMEOUT_MS / 1000} с` : ''),
    );
  });
}

async function main() {
  const { run, skipped } = splitGates(gatesFromWorkflow(readFileSync(WORKFLOW, 'utf8')));
  if (process.argv.includes('--list')) {
    console.log(formatList(run, skipped));
    return 0;
  }

  const scratch = mkdtempSync(join(tmpdir(), 'precheck-'));
  const tree = join(scratch, 'tree');
  const cleanup = () => {
    removeTree(ROOT, tree);
    rmSync(scratch, { recursive: true, force: true });
  };
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      currentChild?.kill('SIGKILL');
      cleanup();
      process.exit(130);
    });
  }

  try {
    createCleanTree(ROOT, tree);
    const failures = [];
    for (const gate of run) {
      const res = await runGate(tree, gate, join(scratch, 'gate.log'));
      if (res.code !== 0) failures.push(formatFailure(gate, res.output, res.note));
    }
    console.log(formatSummary({ total: run.length, skipped: skipped.length, failures }));
    return failures.length ? 1 : 0;
  } finally {
    cleanup();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`✗ precheck: сам инструмент упал — ${err.message}`);
    process.exit(2);
  },
);
