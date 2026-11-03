// Карта инвалидации кабинета терапевта (apiCacheRules.therapy.ts) и
// офлайн-клиенты. Их id отрицательный (-TherapyRelation.id), а шаблоны `\d+`
// минус не брали: после удаления офлайн-клиент висел в списке, «Сегодня» и
// сайдбаре, заметка и новое имя не показывались до 2 минут (QA 2026-10-26).
// Полноту держим от источника истины — декораторов контроллеров, а не от
// списка в этом файле: новая ручка с :clientId без правила краснеет здесь.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from './apiCacheRules.data';
import { applyMutationInvalidation } from './apiCacheRules';
import { cachedGet, clearApiCache, type InvalidationTarget } from './apiCache';

const THERAPY_DIR = join(__dirname, '..', '..', '..', 'src', 'therapy');

/** Мутации с id клиента в пути, которым сбрасывать нечего, — с причиной. */
const NO_RULE: Record<string, string> = {
  'POST /api/therapy/request-ysq/:clientId':
    'только планирует клиенту уведомление, у терапевта не меняется ни один GET (NO_INVALIDATION в apiCacheRules.coverage.test.ts)',
};

function clientIdMutations(): { key: string; method: string; path: string }[] {
  const found: { key: string; method: string; path: string }[] = [];
  for (const file of readdirSync(THERAPY_DIR)) {
    if (!file.endsWith('.controller.ts')) continue;
    const src = readFileSync(join(THERAPY_DIR, file), 'utf8');
    const prefix = src.match(/@Controller\('([^']*)'\)/)?.[1] ?? '';
    for (const m of src.matchAll(
      /@(Post|Delete|Patch)\('([^']*:clientId[^']*)'\)/g,
    )) {
      const method = m[1].toUpperCase();
      const path = `/${prefix}/${m[2]}`;
      found.push({ key: `${method} ${path}`, method, path });
    }
  }
  return found;
}

function targetsOf(method: string, path: string): InvalidationTarget[] | null {
  const hits = RULES.filter((r) => r.method === method && r.pattern.test(path));
  if (hits.length === 0) return null;
  return hits.flatMap(
    (r) => r.targets?.(path.match(r.pattern)!, undefined) ?? [],
  );
}

const withId = (
  t: InvalidationTarget,
  from: string,
  to: string,
): InvalidationTarget =>
  typeof t === 'string'
    ? t.replace(`/${from}`, `/${to}`)
    : { prefix: t.prefix.replace(`/${from}/`, `/${to}/`) };

describe('мутации с :clientId — офлайн-клиент (-57) сбрасывает то же, что 57', () => {
  const mutations = clientIdMutations();
  const ruled = mutations.filter((m) => !(m.key in NO_RULE));

  it('ручки найдены в контроллерах (иначе проверка вечнозелёная)', () => {
    expect(ruled.length).toBeGreaterThanOrEqual(6);
  });

  it.each(ruled)('$key', ({ method, path }) => {
    const pos = targetsOf(method, path.replace(':clientId', '57'));
    const neg = targetsOf(method, path.replace(':clientId', '-57'));
    expect(
      pos,
      `нет правила в apiCacheRules.therapy.ts для ${method} ${path}`,
    ).not.toBeNull();
    expect(pos!.length).toBeGreaterThan(0);
    expect(neg).toEqual(pos!.map((t) => withId(t, '57', '-57')));
  });

  it('каждое исключение NO_RULE всё ещё есть в контроллерах', () => {
    const live = new Set(mutations.map((m) => m.key));
    expect(Object.keys(NO_RULE).filter((k) => !live.has(k))).toEqual([]);
  });

  // Контрольный образец: выдуманная ручка с :clientId не покрыта ничем.
  it('незарегистрированная ручка с id клиента НЕ считается покрытой', () => {
    expect(targetsOf('POST', '/api/therapy/no-such-route/-57')).toBeNull();
  });
});

async function seed(
  paths: string[],
): Promise<Record<string, ReturnType<typeof vi.fn>>> {
  const fetchers: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const p of paths) {
    fetchers[p] = vi.fn(() => Promise.resolve(`data:${p}`));
    await cachedGet(p, fetchers[p]);
  }
  return fetchers;
}

/** Сколько раз ключ сходил в сеть после мутации: 2 — сброшен, 1 — остался в кеше. */
async function refetched(
  f: Record<string, ReturnType<typeof vi.fn>>,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const p of Object.keys(f)) {
    await cachedGet(p, f[p]);
    out[p] = f[p].mock.calls.length;
  }
  return out;
}

describe('applyMutationInvalidation: офлайн-клиент сохранил → кабинет видит новое', () => {
  beforeEach(() => clearApiCache());

  it('DELETE клиента -57: список, канбан и данные -57 сброшены, соседний 57 цел', async () => {
    const f = await seed([
      '/api/therapy/clients',
      '/api/therapy/tasks/all',
      '/api/therapy/notes/-57',
      '/api/therapy/client/-57/diary',
      '/api/therapy/notes/57',
    ]);
    applyMutationInvalidation('DELETE', '/api/therapy/clients/-57', undefined);
    expect(await refetched(f)).toEqual({
      '/api/therapy/clients': 2,
      '/api/therapy/tasks/all': 2,
      '/api/therapy/notes/-57': 2,
      '/api/therapy/client/-57/diary': 2,
      '/api/therapy/notes/57': 1,
    });
  });

  it('переименование -57 сбрасывает список клиентов и канбан', async () => {
    const f = await seed(['/api/therapy/clients', '/api/therapy/tasks/all']);
    applyMutationInvalidation(
      'POST',
      '/api/therapy/rename-client/-57',
      '{"alias":"А"}',
    );
    expect(await refetched(f)).toEqual({
      '/api/therapy/clients': 2,
      '/api/therapy/tasks/all': 2,
    });
  });

  it('заметка -57 сбрасывает заметки -57, но не 57', async () => {
    const f = await seed(['/api/therapy/notes/-57', '/api/therapy/notes/57']);
    applyMutationInvalidation('POST', '/api/therapy/notes/-57', '{"text":"x"}');
    expect(await refetched(f)).toEqual({
      '/api/therapy/notes/-57': 2,
      '/api/therapy/notes/57': 1,
    });
  });

  it('дата сессии -57 сбрасывает данные клиента и список («Сегодня»)', async () => {
    const f = await seed([
      '/api/therapy/client-data/-57',
      '/api/therapy/clients',
    ]);
    applyMutationInvalidation('POST', '/api/therapy/session-info/-57', '{}');
    expect(await refetched(f)).toEqual({
      '/api/therapy/client-data/-57': 2,
      '/api/therapy/clients': 2,
    });
  });

  it('задание офлайн-клиенту (clientId: -57 в теле) сбрасывает его задания и канбан', async () => {
    const f = await seed([
      '/api/therapy/tasks/client/-57',
      '/api/therapy/tasks/all',
    ]);
    applyMutationInvalidation(
      'POST',
      '/api/therapy/tasks',
      JSON.stringify({ clientId: -57, text: 'x' }),
    );
    expect(await refetched(f)).toEqual({
      '/api/therapy/tasks/client/-57': 2,
      '/api/therapy/tasks/all': 2,
    });
  });

  // QA 2026-10-26: задание нельзя было удалить; удалённое не должно висеть в
  // карточке клиента (в том числе офлайн, -57) и на доске до 2 минут.
  it('удаление и отметка задания терапевтом сбрасывают задания клиентов и доску', async () => {
    for (const [method, path] of [
      ['DELETE', '/api/therapy/tasks/9'],
      ['POST', '/api/therapy/tasks/9/complete'],
    ]) {
      clearApiCache();
      const f = await seed([
        '/api/therapy/tasks/client/-57',
        '/api/therapy/tasks/client/57',
        '/api/therapy/tasks/all',
        '/api/therapy/clients',
      ]);
      applyMutationInvalidation(method, path, undefined);
      expect(await refetched(f)).toEqual({
        '/api/therapy/tasks/client/-57': 2,
        '/api/therapy/tasks/client/57': 2,
        '/api/therapy/tasks/all': 2,
        '/api/therapy/clients': 1,
      });
    }
  });

  it('правка карты режимов (PATCH по mapId) сбрасывает карту и список карт клиента', async () => {
    const f = await seed([
      '/api/therapy/mode-maps/-57',
      '/api/therapy/mode-maps/map/3',
    ]);
    applyMutationInvalidation(
      'PATCH',
      '/api/therapy/mode-maps/map/3',
      '{"nodes":[]}',
    );
    expect(await refetched(f)).toEqual({
      '/api/therapy/mode-maps/-57': 2,
      '/api/therapy/mode-maps/map/3': 2,
    });
  });
});
