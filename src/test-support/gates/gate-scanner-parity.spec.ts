// Сканер комментариев/строк (stripComments) дублирован в ДВУХ файлах —
// check-unwatched-code.mjs и check-public-scripts.mjs — потому что гейты
// обязаны быть однофайловыми (gate-sandbox копирует РОВНО один скрипт в
// песочницу, общий модуль импортировать нельзя). Осознанное дублирование
// названо и объяснено прямо над функцией в обоих файлах (маркеры
// `gate-scanner-dup:start`/`:end`), но у дублирования есть родовая болезнь:
// правку внесли в одну копию, вторая тихо осталась старой (то самое, против
// чего в CLAUDE.md правило №13 «конфликты лечит механизм, а не аккуратность»).
// Этот тест — механизм: сравнивает извлечённый текст функции байт-в-байт.
import { readFileSync } from 'fs';
import { join } from 'path';

// src/test-support/gates → корень репозитория на 3 уровня выше (как в gate-sandbox.ts).
const SCRIPTS_DIR = join(__dirname, '..', '..', '..', 'scripts');
const START = 'gate-scanner-dup:start';
const END = 'gate-scanner-dup:end';

function extractBetween(text: string, start: string, end: string): string {
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  if (from === -1 || to === -1) {
    throw new Error(`маркеры ${start}/${end} не найдены`);
  }
  return text.slice(from + start.length, to);
}

function extractScanner(file: string): string {
  return extractBetween(
    readFileSync(join(SCRIPTS_DIR, file), 'utf8'),
    START,
    END,
  );
}

describe('дублированный сканер stripComments — копии не разошлись', () => {
  it('check-unwatched-code.mjs и check-public-scripts.mjs байт-в-байт совпадают', () => {
    const a = extractScanner('check-unwatched-code.mjs');
    const b = extractScanner('check-public-scripts.mjs');
    expect(a).toBe(b);
  });

  it('маркеры реально отделяют непустой блок с функцией (не пустое совпадение)', () => {
    const a = extractScanner('check-unwatched-code.mjs');
    expect(a).toContain('function stripComments');
    expect(a.length).toBeGreaterThan(200);
  });

  // Проверяем ОБА исхода: сама логика сравнения обязана ловить расхождение —
  // иначе тест выше зеленеет всегда и ничего не доказывает.
  it('extractBetween ловит расхождение между двумя версиями (контрольный случай)', () => {
    const a = `// ${START}\nfunction f() { return 1; }\n// ${END}`;
    const b = `// ${START}\nfunction f() { return 2; }\n// ${END}`;
    expect(extractBetween(a, START, END)).not.toBe(
      extractBetween(b, START, END),
    );
  });
});
