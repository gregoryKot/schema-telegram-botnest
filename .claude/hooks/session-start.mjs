#!/usr/bin/env node
// Хук SessionStart: одна строка-подсказка в контекст, только когда она нужна.
//
// Облачная сессия стартует со свежего клона без node_modules. Агент узнаёт об
// этом из длинной ошибки `npx jest` или гейта и тратит на это вызов и контекст.
// Хук говорит заранее — и молчит, если всё на месте (stdout SessionStart
// попадает в контекст, поэтому пустой вывод — норма, а не ошибка).
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Подсказки для корня проекта `root` (пустой массив — сказать нечего). */
export function hints(root) {
  const out = [];
  if (!existsSync(join(root, 'node_modules'))) {
    out.push(
      'Зависимости не установлены: перед тестами и гейтами, которым нужен node_modules, — `npm ci --silent` (около минуты).',
    );
  }
  return out;
}

function main() {
  try {
    const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const lines = hints(root);
    if (lines.length) process.stdout.write(lines.join('\n') + '\n');
  } catch {
    // Подсказка не должна мешать старту сессии.
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
