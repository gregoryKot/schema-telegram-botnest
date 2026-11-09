// Единственный обход дерева исходников для статических трипваеров (issue #215).
//
// До этого рекурсивный `walk(dir)` был скопирован в восьми местах
// (log-leak/injection/ssrf/dto-validation/crisis-path/analytics-sync,
// controller-classification, encryption-rotation-coverage) — ровно тот случай,
// против которого правило «одна механика — один компонент»: починку внесли в
// одну копию (#214), семь остальных тихо остались старыми.
//
// Чинит два класса проблем разом:
//
//  1. Гонка с кэшем jest. Копии делали `readdirSync` + отдельный `statSync` по
//     каждому имени. Относительный `--cacheDirectory=.jest-cache` jest
//     резолвит от rootDir конфига, то есть кладёт кэш в `src/.jest-cache/`
//     (так жила джоба `backend`, пока `JEST_CACHE_DIR` в ci.yml не стал
//     абсолютным; локальный прогон с таким флагом делает так и сейчас), и
//     параллельные воркеры чистят его прямо во время обхода: файл исчезал
//     между двумя вызовами → ENOENT ронял джобу `backend` мимо её темы.
//     Здесь окна гонки нет вообще —
//     тип записи берётся из `withFileTypes` (readdir отдаёт его сразу), а
//     скрытые записи (`.jest-cache`, `.stryker-tmp`, `.claude`) пропускаются.
//  2. Расхождение фильтров. У копий они разъехались: одни отбрасывали только
//     `*.spec.ts`, другие ещё `*.test.ts` и `*.d.ts`. Теперь правило одно.
//
// Порядок результата стабильный (сортировка по имени внутри каталога) — иначе
// список файлов зависел бы от порядка выдачи ФС, и вывод упавшего трипваера
// прыгал бы от прогона к прогону.
import { readdirSync } from 'fs';
import { join } from 'path';

/** Тесты и файлы деклараций — не исходники, статические проверки их не смотрят. */
const NON_SOURCE_RE = /\.(spec|test)\.tsx?$|\.d\.ts$/;

export interface CollectSourceFilesOptions {
  /** Расширения, которые попадают в выборку. По умолчанию — только `.ts`. */
  extensions?: string[];
  /**
   * Дополнительный фильтр по абсолютному пути — поверх расширений и
   * отбрасывания тестов/деклараций (напр. только `*.controller.ts`).
   */
  filter?: (path: string) => boolean;
  /** Брать и `*.spec.*`/`*.test.*` — для сверок «у каждого X есть тест». */
  includeTests?: boolean;
}

/**
 * Рекурсивно собирает исходники из `dir`: пропускает скрытые каталоги и файлы,
 * `*.d.ts` и (без `includeTests`) `*.spec.*`, `*.test.*`.
 */
export function collectSourceFiles(
  dir: string,
  options: CollectSourceFilesOptions = {},
): string[] {
  const { extensions = ['.ts'], filter, includeTests = false } = options;
  const skip = includeTests ? /\.d\.ts$/ : NON_SOURCE_RE;
  const out: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    // Скрытое — служебное (кэш jest, песочница Stryker, worktree агентов):
    // не наш код и исчезает под ногами прямо во время обхода.
    if (entry.name.startsWith('.')) continue;

    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(path, options));
      continue;
    }
    if (!extensions.some((ext) => path.endsWith(ext))) continue;
    if (skip.test(path)) continue;
    if (filter && !filter(path)) continue;
    out.push(path);
  }

  return out;
}
