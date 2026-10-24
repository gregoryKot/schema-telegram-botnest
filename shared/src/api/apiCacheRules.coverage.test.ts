// Гейт полноты карты инвалидации. Сама карта (apiCacheRules.data.ts) —
// список решений, а список без принуждения протухает: следующий POST,
// добавленный в api-слой, просто не попадёт в карту, и пользователь после
// сохранения увидит свои СТАРЫЕ данные (кеш свежий 15 секунд). Со стороны
// тестов это неотличимо от нормы — ни один существующий тест не упадёт.
//
// Поэтому здесь мы идём от источника истины — реальных вызовов мутаций в
// api-слое — и требуем, чтобы у каждого нашёлся обработчик в RULES либо
// осознанная запись в NO_INVALIDATION с причиной (правило №15 CLAUDE.md:
// исключение — только с обоснованием, и у него обязан быть контрольный
// образец, см. последний тест файла).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from './apiCacheRules.data';

const SOURCES = [
  'shared/src/api/sharedApi.ts',
  'shared/src/api/ratingApi.ts',
  'shared/src/api/apiExercises.ts',
];

/** Мутации, которым нечего сбрасывать — с причиной, а не «и так сойдёт». */
const NO_INVALIDATION: Record<string, string> = {
  'POST /api/init':
    'заводит юзера/таймзону, ни один кешируемый GET от неё не зависит',
  'POST /api/event':
    'аналитика, fire-and-forget — не меняет ничего, что читают GET-ы',
  'POST /api/public-event': 'аналитика анонимного посетителя, см. выше',
  'POST /api/therapy/invite':
    'создаёт связь со статусом pending; GET /api/therapy/relation и список клиентов читают только active — до присоединения клиента ни один кешируемый GET не меняется (код приглашения возвращается самим ответом)',
  'POST /api/therapy/request-ysq/1':
    'просит клиента пройти YSQ — планирует ему уведомление и больше ничего; у терапевта в кеше от этого не меняется ни один GET (src/therapy/therapy-client-data.service.ts requestYsq)',
  'POST /api/activity':
    'отметка «заходил сегодня» — читается только серверными отчётами (/stats), кешируемого GET у неё нет',
};

const REPO_ROOT = join(__dirname, '..', '..', '..');

/** `/api/plan/${id}/checkin` → `/api/plan/1/checkin` (пример пути для матчинга). */
const sampleFor = (template: string): string =>
  template.replace(/\$\{[^}]*\}/g, '1');

function collectMutations(): { key: string; sample: string }[] {
  const found = new Map<string, string>();
  const call =
    /\bt\.(post|postJson|del|patchJson)\s*<[^>]*>?\s*\(\s*[`'"]([^`'"]+)[`'"]|\bt\.(post|postJson|del|patchJson)\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
  for (const rel of SOURCES) {
    let src: string;
    try {
      src = readFileSync(join(REPO_ROOT, rel), 'utf8');
    } catch {
      continue; // файл переехал — это ловят другие гейты, не этот
    }
    for (const m of src.matchAll(call)) {
      const fn = m[1] ?? m[3];
      const path = m[2] ?? m[4];
      if (!fn || !path?.startsWith('/api/')) continue;
      const method =
        fn === 'del' ? 'DELETE' : fn === 'patchJson' ? 'PATCH' : 'POST';
      const sample = sampleFor(path);
      found.set(`${method} ${sample.split('?')[0]}`, sample.split('?')[0]);
    }
  }
  return [...found].map(([key, sample]) => ({ key, sample }));
}

const hasRule = (method: string, pathname: string): boolean =>
  RULES.some((r) => r.method === method && r.pattern.test(pathname));

describe('карта инвалидации покрывает все мутации api-слоя', () => {
  const mutations = collectMutations();

  it('вызовы мутаций вообще найдены (иначе гейт вечнозелёный)', () => {
    expect(mutations.length).toBeGreaterThan(20);
  });

  it.each(mutations)(
    '$key — есть правило или осознанное исключение',
    ({ key, sample }) => {
      const [method] = key.split(' ');
      const covered = hasRule(method, sample) || key in NO_INVALIDATION;
      expect(
        covered,
        `Мутация ${key} ничего не сбрасывает в кеше GET-ответов.\n` +
          `Добавь строку в shared/src/api/apiCacheRules.data.ts — или, если ` +
          `сбрасывать правда нечего, запись с причиной в NO_INVALIDATION ` +
          `(этот файл).`,
      ).toBe(true);
    },
  );

  it('каждое исключение из NO_INVALIDATION всё ещё существует в api-слое', () => {
    const live = new Set(mutations.map((m) => m.key));
    const stale = Object.keys(NO_INVALIDATION).filter((k) => !live.has(k));
    expect(
      stale,
      'Протухшие записи NO_INVALIDATION: роут исчез или переименован — ' +
        'сверься, что произошло, и убери запись.',
    ).toEqual([]);
  });

  // Контрольный образец (правило №15): исключение не должно быть шире, чем
  // нужно. Выдуманная мутация не покрыта ни RULES, ни NO_INVALIDATION —
  // если этот тест позеленеет «сам собой», гейт перестал что-либо ловить.
  it('незарегистрированная мутация НЕ считается покрытой', () => {
    expect(hasRule('POST', '/api/такого-роута-нет')).toBe(false);
    expect('POST /api/такого-роута-нет' in NO_INVALIDATION).toBe(false);
  });
});
