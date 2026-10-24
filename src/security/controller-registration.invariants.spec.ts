// Трипваер: каждый контроллер зарегистрирован в каком-нибудь модуле.
//
// Инцидент 2026-07-27: после распила api.controller (PR #43) SettingsController
// существовал в исходниках, но не попал в `ApiModule.controllers` — GET/POST
// /api/settings отвечали 404 на проде, экраны настроек били в пустоту. Ни один
// юнит-тест этого не видел: класс компилировался, методы вызывались напрямую
// в спеках и возвращали правильные данные. Не существовало только самого
// маршрута.
//
// e2e-route-coverage.invariants.spec.ts ловит ту же дыру с другой стороны
// («на маршрут никто не ходит через HTTP»), но требует, чтобы кто-то ЗАВЁЛ
// e2e. Эта проверка дешевле и срабатывает раньше: класс-контроллер, которого
// нет ни в одном `controllers: [...]`, — это мёртвый код, притворяющийся
// работающим API.
//
// Парсинг простой (regex по спискам `controllers:`), как и у соседних
// трипваеров: цель — поймать очевидный дрейф, а не разобрать TypeScript.
//
// Реестр может жить не только литералом в @Module(...): правило №10
// CLAUDE.md заставляет модули с длинным списком контроллеров/провайдеров
// выносить массив в отдельный `*.registry.ts` (см. booking.module.ts →
// booking.registry.ts) — тогда в самом модуле стоит `controllers:
// BOOKING_CONTROLLERS` (идентификатор, не `[...]`). Ниже это тоже
// распознаётся: находим `import { ИМЯ } from './путь'` в модуле и читаем
// `export const ИМЯ = [...]` из указанного файла.
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

import { collectSourceFiles } from './collect-source-files';
import { SRC, walkControllers } from './controller-classification';

/** Имена классов с декоратором @Controller во всех *.controller.ts. */
function declaredControllerClasses(): Map<string, string> {
  const byClass = new Map<string, string>();
  for (const file of walkControllers()) {
    const text = readFileSync(file, 'utf8');
    // Между @Controller и объявлением класса могут стоять другие декораторы
    // (@UseGuards, @UseInterceptors) — поэтому пропускаем всё, что начинается
    // с @, а не требуем `export class` сразу следом.
    const re =
      /@Controller\([^)]*\)\s*(?:@[\w.]+\([^)]*\)\s*)*export\s+class\s+(\w+)/g;
    for (let m = re.exec(text); m !== null; m = re.exec(text)) {
      byClass.set(m[1], file.replace(`${SRC}/`, ''));
    }
  }
  return byClass;
}

function addNames(raw: string, out: Set<string>): void {
  for (const part of raw.split(',')) {
    const name = part
      .trim()
      .replace(/\/\/.*$/, '')
      .trim();
    if (/^\w+$/.test(name)) out.add(name);
  }
}

/**
 * `controllers: ИМЯ` (идентификатор, не массив-литерал) — реестр вынесен в
 * отдельный файл. Находим, откуда ИМЯ импортировано в модуле, и читаем
 * `export const ИМЯ = [...]` там. Возвращает null, если файл/экспорт не
 * нашёлся — тогда контроллер честно остаётся orphan, а не проходит молча.
 */
function resolveIndirectArray(
  moduleText: string,
  moduleFile: string,
  name: string,
): string | null {
  const importRe = new RegExp(
    `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"](\\.[^'"]+)['"]`,
  );
  const importMatch = importRe.exec(moduleText);
  if (!importMatch) return null;
  const targetPath = join(dirname(moduleFile), `${importMatch[1]}.ts`);
  let targetText: string;
  try {
    targetText = readFileSync(targetPath, 'utf8');
  } catch {
    return null;
  }
  const arrRe = new RegExp(`export const ${name}\\s*=\\s*\\[([^\\]]*)\\]`);
  return arrRe.exec(targetText)?.[1] ?? null;
}

/** Имена классов, перечисленных в `controllers: [...]` любого модуля (прямо
 *  или через вынесенный `*.registry.ts`, см. комментарий у импортов). */
function registeredControllerClasses(): Set<string> {
  const registered = new Set<string>();
  const modules = collectSourceFiles(SRC, {
    filter: (p) => p.endsWith('.module.ts'),
  });
  for (const file of modules) {
    const text = readFileSync(file, 'utf8');
    const literalRe = /controllers\s*:\s*\[([^\]]*)\]/g;
    for (let m = literalRe.exec(text); m !== null; m = literalRe.exec(text)) {
      addNames(m[1], registered);
    }
    const indirectMatch = /controllers\s*:\s*(\w+)/.exec(text);
    if (indirectMatch) {
      const resolved = resolveIndirectArray(text, file, indirectMatch[1]);
      if (resolved) addNames(resolved, registered);
    }
  }
  return registered;
}

describe('трипваер: контроллер без модуля = маршрута нет', () => {
  const declared = declaredControllerClasses();
  const registered = registeredControllerClasses();

  it('каждый @Controller перечислен в controllers какого-нибудь модуля', () => {
    const orphans = [...declared.entries()]
      .filter(([cls]) => !registered.has(cls))
      .map(([cls, file]) => `${cls} (${file})`)
      .sort();
    expect(orphans).toEqual([]);
  });

  it('в модулях не перечислен контроллер, которого больше нет', () => {
    // Обратная сторона того же дрейфа: имя осталось в списке после
    // переименования/удаления файла — приложение не поднимется вовсе, и
    // узнаем мы об этом при старте прода, а не здесь.
    const ghosts = [...registered]
      .filter((cls) => cls.endsWith('Controller') && !declared.has(cls))
      .sort();
    expect(ghosts).toEqual([]);
  });

  it('проверка не выродилась: контроллеры вообще найдены', () => {
    // Если регэксп однажды перестанет матчить (сменился стиль объявления),
    // оба теста выше станут «зелёными на пустом множестве» — самый опасный
    // исход для трипваера.
    expect(declared.size).toBeGreaterThan(20);
    expect(registered.size).toBeGreaterThan(20);
  });
});
