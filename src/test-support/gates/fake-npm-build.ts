// Поддельный `npm` для теста pre-push хука (git-hooks.spec.ts): хук зовёт
// `npm run build --prefix <webapp>`, и проверяется он как вызывающий сборку с
// нужным окружением и как читатель кода выхода и лога, а не как сборщик —
// настоящая сборка webapp в песочнице не нужна и дорога. Не путать с
// fake-npm.ts: тот отвечает записанными ответами реестра на `npm audit`.
import { chmodSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

/** Пишет аргументы и VITE_BOT_USERNAME в $FAKE_NPM_RECORD, печатает длинный
 *  «лог сборки» и падает с образцом ошибки при FAKE_NPM_FAIL. Возвращает
 *  каталог для PATH. */
export function makeFakeNpmBuild(dir: string): string {
  const bin = join(dir, 'fake-bin');
  mkdirSync(bin, { recursive: true });
  const script = [
    '#!/bin/sh',
    'printf \'%s\\n\' "$*" > "$FAKE_NPM_RECORD"',
    'printf \'%s\\n\' "VITE_BOT_USERNAME=${VITE_BOT_USERNAME-<не задан>}" >> "$FAKE_NPM_RECORD"',
    'i=0; while [ $i -lt 40 ]; do echo "строка лога сборки $i"; i=$((i+1)); done',
    'if [ -n "${FAKE_NPM_FAIL:-}" ]; then echo "ОШИБКА-ОБРАЗЕЦ: error TS2307" >&2; exit 1; fi',
    'exit 0',
    '',
  ].join('\n');
  writeFileSync(join(bin, 'npm'), script);
  chmodSync(join(bin, 'npm'), 0o755);
  return bin;
}
