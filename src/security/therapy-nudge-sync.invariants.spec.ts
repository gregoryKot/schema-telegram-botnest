// Трипваер: «Мост к терапевту» на фронте и бэке (правило №4 CLAUDE.md).
// Бэкенд валидирует meta по THERAPY_NUDGE_PLACES/_ACTIONS/_TRIGGERS
// (src/analytics/therapy-nudge.constants.ts), фронт держит union-типы в
// shared/src/analytics/therapyNudge.ts. Расхождение молча роняет метрику:
// сервер отбросит неизвестное значение (место или действие — всю meta).
// Файл фронта не найден или не разобран — тест падает громко, а не пропускается.
import { readFileSync } from 'fs';
import { join } from 'path';
import { HOME_EVENTS } from '../analytics/home-events.constants';
import {
  THERAPY_NUDGE_ACTIONS,
  THERAPY_NUDGE_EVENT,
  THERAPY_NUDGE_PLACES,
  THERAPY_NUDGE_TRIGGERS,
} from '../analytics/therapy-nudge.constants';

const ROOT = join(__dirname, '..', '..');
const FRONTEND_REL = 'shared/src/analytics/therapyNudge.ts';

function readFrontend(): string {
  try {
    return readFileSync(join(ROOT, FRONTEND_REL), 'utf8');
  } catch {
    throw new Error(
      `Не найден файл ${FRONTEND_REL}: сверка therapy_nudge невозможна.`,
    );
  }
}

// Достаёт строковые литералы из `export type X = | 'a' | 'b';`.
function extractUnion(src: string, typeName: string): string[] {
  const m = src.match(new RegExp(`export type ${typeName}\\s*=([^;]+);`));
  if (!m) throw new Error(`Не нашли union-тип ${typeName} в ${FRONTEND_REL}.`);
  return [...m[1].matchAll(/['"]([a-z][a-z0-9_]*)['"]/g)].map((x) => x[1]);
}

const PAIRS: Array<[string, string, readonly string[]]> = [
  ['TherapyNudgePlace', 'THERAPY_NUDGE_PLACES', THERAPY_NUDGE_PLACES],
  ['TherapyNudgeAction', 'THERAPY_NUDGE_ACTIONS', THERAPY_NUDGE_ACTIONS],
  ['TherapyNudgeTrigger', 'THERAPY_NUDGE_TRIGGERS', THERAPY_NUDGE_TRIGGERS],
];

describe('трипваер: therapy_nudge фронта и бэка совпадают (правило №4)', () => {
  describe.each(PAIRS)('%s и %s', (typeName, _registry, backendList) => {
    it('бэкендный реестр непуст и без дублей', () => {
      expect(backendList.length).toBeGreaterThan(0);
      expect(new Set(backendList).size).toBe(backendList.length);
    });

    it('на фронте нет дублей', () => {
      const front = extractUnion(readFrontend(), typeName);
      expect(front.length).toBeGreaterThan(0);
      expect(new Set(front).size).toBe(front.length);
    });

    it('каждое значение бэкенда есть на фронте', () => {
      const front = new Set(extractUnion(readFrontend(), typeName));
      expect(backendList.filter((v) => !front.has(v))).toEqual([]);
    });

    it('каждое значение фронта есть в allow-list бэка', () => {
      const back = new Set<string>(backendList);
      expect(
        extractUnion(readFrontend(), typeName).filter((v) => !back.has(v)),
      ).toEqual([]);
    });
  });

  it('имя события на фронте (THERAPY_NUDGE_EVENT) совпадает с бэком и входит в HOME_EVENTS', () => {
    const m = readFrontend().match(
      /THERAPY_NUDGE_EVENT\s*=\s*['"]([a-z_]+)['"]/,
    );
    expect(m).not.toBeNull();
    expect(m![1]).toBe(THERAPY_NUDGE_EVENT);
    expect((HOME_EVENTS as readonly string[]).includes(m![1])).toBe(true);
  });
});
