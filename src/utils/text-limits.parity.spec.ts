// Сверка двух реестров (правило №4 CLAUDE.md): пределы текста на бэкенде
// (`src/utils/text-limits.ts`, по ним стоят `@MaxLength` в DTO) и на фронтах
// (`shared/src/limits/textLimits.ts`, по ним стоят `maxLength` полей ввода).
// Разъехались — человек упирается в предел, которого сервер не знает (фронт
// строже: поле «не принимает», хотя сервер пустил бы), либо, хуже, поле
// пускает больше, чем примет сервер: текст набран, а на «Сохранить» — 400.
import { readFileSync } from 'fs';
import { join } from 'path';
import * as backend from './text-limits';

const SHARED = join(
  __dirname,
  '..',
  '..',
  'shared',
  'src',
  'limits',
  'textLimits.ts',
);

function readSharedLimits(): Record<string, number> {
  const out: Record<string, number> = {};
  const src = readFileSync(SHARED, 'utf8');
  for (const m of src.matchAll(
    /^export const ([A-Z][A-Z0-9_]*_MAX) = (\d+);/gm,
  )) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

describe('пределы текста: бэкенд ↔ shared', () => {
  const shared = readSharedLimits();

  it('в shared нашлись константы (парсер не промахнулся)', () => {
    expect(Object.keys(shared).length).toBeGreaterThanOrEqual(10);
  });

  it('каждая константа бэкенда есть в shared с тем же значением', () => {
    for (const [name, value] of Object.entries(backend)) {
      expect({ name, value: shared[name] }).toEqual({ name, value });
    }
  });

  it('в shared нет констант, которых нет на бэкенде (иначе предел фронта никто не проверяет)', () => {
    const extra = Object.keys(shared).filter((n) => !(n in backend));
    expect(extra).toEqual([]);
  });
});
