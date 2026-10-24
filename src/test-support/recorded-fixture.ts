// Загрузчик фикстур `test/fixtures/recorded/**` (CLAUDE.md, правило №14:
// «тесты стояли по обе стороны шва, но не на шве»). Два из трёх последних
// инцидентов календаря (PR #491, PR #494) были одним классом — парсер
// внешнего формата тестировался на фикстуре, которую выдумал сам автор,
// а не на том, что реально присылает площадка. Этот файл — единственная
// точка чтения таких фикстур, чтобы спеки в `src/**` не изобретали свой
// путь до `test/fixtures/recorded/` (jest `rootDir` в package.json — `src`,
// поэтому относительный путь от файла-спека ненадёжен при переносах).
//
// Расположение — `src/test-support/` (не `test/fixtures/recorded/load.ts`):
// спеки лежат в `src/**` и импортируют помощники оттуда относительным путём
// (см. `fake-prisma.spec-helper.ts`); из прод-сборки исключено
// (`tsconfig.build.json` → `exclude: ["src/test-support"]`), из гейта мёртвых
// файлов — тоже (`check-dead-files.mjs` не требует потребителя у
// `test-support/**`, он существует ради тестов по определению).
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

// От `src/test-support/` до корня репозитория — два уровня вверх.
const REPO_ROOT = resolve(__dirname, '..', '..');
const FIXTURES_DIR = join(REPO_ROOT, 'test', 'fixtures', 'recorded');

export interface RecordedFixtureMeta {
  source: string;
  recordedAt: string;
  how: string;
  redacted: string;
}

/**
 * Содержимое записанной фикстуры `test/fixtures/recorded/<name>` как текст.
 * Бросает содержательную ошибку, если файла нет — вместо неясного ENOENT
 * из fs, чтобы автор нового спека сразу понял, где искать каталог и README.
 */
export function loadRecordedFixture(name: string): string {
  const path = join(FIXTURES_DIR, name);
  if (!existsSync(path)) {
    throw new Error(
      `loadRecordedFixture: нет файла test/fixtures/recorded/${name}. ` +
        'См. test/fixtures/recorded/README.md — как класть новую фикстуру ' +
        '(формат, обезличивание) и scripts/check-recorded-fixtures.mjs — ' +
        'какие парсеры обязаны на неё ссылаться.',
    );
  }
  return readFileSync(path, 'utf8');
}

/** Сайдкар `<name>.meta.json` той же фикстуры — источник/дата/как получено. */
export function loadRecordedFixtureMeta(name: string): RecordedFixtureMeta {
  const raw = loadRecordedFixture(`${name}.meta.json`);
  return JSON.parse(raw) as RecordedFixtureMeta;
}
