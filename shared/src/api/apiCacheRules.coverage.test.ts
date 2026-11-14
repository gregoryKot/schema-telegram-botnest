/// <reference types="node" />
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

// Где живут вызовы мутаций: общий api-слой (`t.post(` через транспорт) и
// api сайта (голые `post(`/`postJson(`/`patchJson(`/`del(` из apiClient).
// До 2026-11 сверка видела только `shared/src/api/*` вида `t.post(`: мутации
// `webapp/src/api.ts` (карты режимов, свои режимы терапевта, упражнения,
// деньги) в неё не попадали, а `apiExercises.ts` из списка давно переехал в
// api сайта — и молча пропускался.
const SOURCES = [
  'shared/src/api/sharedApi.ts',
  'shared/src/api/ratingApi.ts',
  'shared/src/api/practiceSessionsApi.ts',
  'webapp/src/api.ts',
  'webapp/src/push/pushApi.ts',
];

/** Мутации, которым нечего сбрасывать — с причиной, а не «и так сойдёт». */
const NO_INVALIDATION: Record<string, string> = {
  'POST /api/init':
    'заводит юзера/таймзону, ни один кешируемый GET от неё не зависит',
  'POST /api/event':
    'аналитика, fire-and-forget — не меняет ничего, что читают GET-ы',
  'POST /api/public-event': 'аналитика анонимного посетителя, см. выше',
  'POST /api/therapy/invite/preview':
    'только читает приглашение (чей код) — ничего не меняет, кешируемых GET у него нет',
  // Деньги и заявки (webapp/src/api.ts): ответ уводит на Robokassa или
  // показывает итог на месте — кешируемого GET, который бы устарел, нет.
  'POST /api/booking':
    'заявка с сайта уходит владельцу (письмо, Telegram) — посетитель её не читает, кешируемого GET у заявки нет',
  'POST /api/donation':
    'создаёт платёж и уводит на Robokassa — у доната нет GET, который читал бы сайт',
  'POST /api/subscription':
    'создаёт подписку и уводит на Robokassa; статус по токену читает уже страница возврата — в кеше этой вкладки его нет',
  'POST /api/plan/ics':
    'выдаёт ссылку на .ics шага плана (E6) — ничего не сохраняет, кешируемого GET у неё нет',
};

const REPO_ROOT = join(__dirname, '..', '..', '..');

/** `/api/plan/${id}/checkin` → `/api/plan/1/checkin` (пример пути для матчинга). */
const sampleFor = (template: string): string =>
  template.replace(/\$\{[^}]*\}/g, '1');

// `t.post(…)` транспорта и голый `post(…)` api сайта; дженерик — с одним
// уровнем вложенности (`postJson<Array<X>>(`). Перед голым именем не точка и
// не буква: `foo.post(`, `repost(` — не мутации api-слоя.
const MUTATION_CALL =
  /(?:\bt\.|(?<![\w.$]))(post|postJson|del|patchJson)\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(\s*[`'"]([^`'"]+)[`'"]/g;

function mutationsIn(src: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const m of src.matchAll(MUTATION_CALL)) {
    const [, fn, path] = m;
    if (!fn || !path?.startsWith('/api/')) continue;
    const method =
      fn === 'del' ? 'DELETE' : fn === 'patchJson' ? 'PATCH' : 'POST';
    const sample = sampleFor(path).split('?')[0];
    found.set(`${method} ${sample}`, sample);
  }
  return found;
}

function collectMutations(): { key: string; sample: string }[] {
  const found = new Map<string, string>();
  for (const rel of SOURCES) {
    // Источника нет — красное: переехавший файл молча выпадал из сверки.
    const src = readFileSync(join(REPO_ROOT, rel), 'utf8');
    for (const [key, sample] of mutationsIn(src)) found.set(key, sample);
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

  // Исключение с причиной «сбрасывать нечего» рядом с правилом, которое
  // сбрасывает, — ложь в одном из двух мест (так жила запись про
  // POST /api/activity: правило сбрасывает стрик и историю).
  it('исключение не дублирует правило карты', () => {
    const both = Object.keys(NO_INVALIDATION).filter((k) => {
      const [method, path] = k.split(' ');
      return hasRule(method, path);
    });
    expect(both).toEqual([]);
  });

  // Сверка видит голые вызовы api сайта и транспорт `t.`, а не любые `.post(`.
  it('разбор вызовов: голый post( и t.post( — мутации; чужой .post( и repost( — нет', () => {
    const keys = [
      ...mutationsIn(
        "post('/api/a', b); t.del(`/api/b/${id}`); postJson<Array<{ x: 1 }>>('/api/c', b);" +
          " fetcher.post('/api/d'); repost('/api/e'); get('/api/f');",
      ).keys(),
    ];
    expect(keys).toEqual(['POST /api/a', 'DELETE /api/b/1', 'POST /api/c']);
  });

  // Контрольный образец (правило №15): исключение не должно быть шире, чем
  // нужно. Выдуманная мутация не покрыта ни RULES, ни NO_INVALIDATION —
  // если этот тест позеленеет «сам собой», гейт перестал что-либо ловить.
  it('незарегистрированная мутация НЕ считается покрытой', () => {
    expect(hasRule('POST', '/api/такого-роута-нет')).toBe(false);
    expect('POST /api/такого-роута-нет' in NO_INVALIDATION).toBe(false);
  });
});
