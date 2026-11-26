// Сверка с каталогом упражнений (QA 2026-11, М6; правило №4): номер и срок
// упражнения жили в шапках экранов и в «Поставить цель» своими копиями и
// разъехались с библиотекой («Письмо» № 04 в шапке и 06 в списке, 30 мин
// против 15–25). Теперь рубрика и срок берутся из
// shared/src/exercises/exerciseCatalog; тест краснеет, если копия вернётся.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXERCISES, exerciseCard } from '../../../../shared/src/exercises/exerciseCatalog';
import { TASK_EXERCISE, TASK_OPTIONS } from '../taskCreate/taskOptions';

// Комментарии не в счёт: «15–25 минут работы терялись» в истории файла — не срок на экране.
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

function screenSources(dir: string): [string, string][] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e): [string, string][] => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return screenSources(p);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [[p, code(readFileSync(p, 'utf8'))]] : [];
  });
}

describe('каталог упражнений — один источник рубрики и срока', () => {
  it('«Поставить цель»: срок упражнения совпадает с библиотекой', () => {
    for (const [type, ex] of Object.entries(TASK_EXERCISE)) {
      const option = TASK_OPTIONS.find((o) => o.type === type);
      expect(option?.time, type).toBe(exerciseCard(ex).time);
    }
  });

  it('экраны упражнений не держат своих номеров «№ 0…» и сроков «N–M минут»', () => {
    const sources = screenSources(__dirname);
    expect(sources.length).toBeGreaterThan(10);
    for (const [path, src] of sources) {
      expect(src, path).not.toMatch(/№\s*\d+\s*·/);
      expect(src, path).not.toMatch(/\d+\s*[–-]\s*\d+\s*мин/);
    }
  });

  it('у каждой карточки есть рубрика и срок вида «N–M мин»', () => {
    for (const ex of EXERCISES) {
      expect(ex.eyebrow, ex.id).not.toBe('');
      expect(ex.time, ex.id).toMatch(/^\d+–\d+ мин$/);
    }
  });
});
