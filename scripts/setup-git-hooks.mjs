#!/usr/bin/env node
// Ставит хуки git репозитория: core.hooksPath → scripts/git-hooks.
//
// Хуки, как и merge-драйверы (setup-merge-drivers.mjs), с клоном не приезжают:
// git принципиально не исполняет ничего из клонированного репозитория без
// явного согласия, поэтому .git/hooks настраивается на каждой машине. Скрипт
// вызывается из npm `prepare` (на каждом `npm install`), руками не нужен;
// идемпотентен. Любая проблема — предупреждение, а не падение: `prepare` не
// имеет права ронять `npm install` (в Docker и CI git-конфига может не быть).
//
// Путь относительный намеренно: относительный core.hooksPath git резолвит от
// корня того рабочего дерева, из которого идёт команда, — поэтому один ключ в
// общем .git/config обслуживает и главный чекаут, и каждый `git worktree`
// (.claude/worktrees/*): пуш из worktree берёт хук из него же, а не из
// главного дерева. Что это так, держит src/test-support/gates/git-hooks.spec.ts.
//
// Заодно ставит хукам бит исполнения: git хранит mode, но на ФС с
// core.fileMode=false он теряется, а хук без +x git молча пропускает.
//
//   node scripts/setup-git-hooks.mjs   — поставить (то же делает prepare)
import { spawnSync } from 'child_process';
import { chmodSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = join(import.meta.dirname, '..');
const HOOKS_DIR = 'scripts/git-hooks';
const MANUAL = 'Поставь вручную: node scripts/setup-git-hooks.mjs';

const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });

if (git('rev-parse', '--show-toplevel').status !== 0) {
  console.log('git-хуки: не git-репозиторий, пропускаю.');
  process.exit(0);
}

if (git('config', 'core.hooksPath', HOOKS_DIR).status !== 0) {
  console.warn(`git-хуки: не удалось записать core.hooksPath — pre-push не стоит. ${MANUAL}`);
  process.exit(0);
}

let hooks = 0;
try {
  for (const name of readdirSync(join(ROOT, HOOKS_DIR))) {
    chmodSync(join(ROOT, HOOKS_DIR, name), 0o755);
    hooks += 1;
  }
} catch (e) {
  console.warn(`git-хуки: не удалось выставить бит исполнения (${e.message}). ${MANUAL}`);
}

// Прежний хук в .git/hooks (у владельца — pre-push со сборкой без
// VITE_BOT_USERNAME) git с core.hooksPath больше не зовёт; скажем об этом.
// --git-common-dir из главного дерева — относительный `.git`, из worktree —
// абсолютный путь: resolve принимает оба.
const common = git('rev-parse', '--git-common-dir');
const legacy =
  common.status === 0 ? resolve(ROOT, common.stdout.trim(), 'hooks', 'pre-push') : '';
const note =
  legacy && existsSync(legacy) ? ` Прежний ${legacy} git больше не вызывает.` : '';

console.log(`git-хуки: core.hooksPath = ${HOOKS_DIR}, хуков ${hooks}.${note}`);
