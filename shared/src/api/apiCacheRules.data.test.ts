// Смок по ВСЕЙ карте мутаций (apiCacheRules.data.ts) — по образцу
// sharedApi.test.ts: каждое правило обязано вернуть валидный список целей
// (строка-ключ или { prefix }), ни одно не падает и не остаётся мёртвым кодом.
import { describe, it, expect } from 'vitest';
import { RULES } from './apiCacheRules.data';
import type { InvalidationTarget } from './apiCache';

function isValidTarget(t: InvalidationTarget): boolean {
  if (typeof t === 'string') return t.startsWith('/');
  return typeof t.prefix === 'string' && t.prefix.startsWith('/');
}

// Тело с максимумом полей, которые может ожидать любое правило — так каждая
// ветка «если поле есть» реально срабатывает хотя бы раз.
const FULL_BODY = {
  date: '2026-01-05',
  needId: 'safety',
  clientId: 7,
};
const FAKE_MATCH = ['/x', '7'] as unknown as RegExpMatchArray;

describe('RULES: каждое правило даёт валидные цели', () => {
  it.each(RULES.map((r, i) => [i, r.method, r.pattern.source] as const))(
    'правило #%i (%s %s)',
    (_i, _method, _src) => {
      const rule = RULES[_i];
      if (rule.clearAll) return; // clearAll проверен отдельно в apiCacheRules.test.ts
      const targets = rule.targets?.(FAKE_MATCH, FULL_BODY) ?? [];
      expect(Array.isArray(targets)).toBe(true);
      for (const t of targets) expect(isValidTarget(t)).toBe(true);
    },
  );

  it('правила с body-зависимой целью — пустой массив без нужного поля', () => {
    const noteRule = RULES.find((r) => r.pattern.source.endsWith('note$'))!;
    expect(noteRule.targets?.(FAKE_MATCH, undefined)).toEqual([]);

    const practicesRule = RULES.find(
      (r) => r.method === 'POST' && r.pattern.source.endsWith('practices$'),
    )!;
    expect(practicesRule.targets?.(FAKE_MATCH, undefined)).toEqual([]);

    const tasksRule = RULES.find(
      (r) => r.method === 'POST' && r.pattern.source.endsWith('tasks$'),
    )!;
    expect(tasksRule.targets?.(FAKE_MATCH, undefined)).toEqual([
      '/api/therapy/tasks',
    ]);
  });
});

// Аудит 2026-10, X-1: clientId веб-клиента — строка > 2^53; ключ кеша
// инвалидации обязан содержать её без округления.
describe('RULES: tasks с clientId веб-клиента', () => {
  it('инвалидирует точный /tasks/client/<строка>', () => {
    const rule = RULES.find(
      (r) =>
        r.method === 'POST' &&
        r.pattern.source === '^\\/api\\/therapy\\/tasks$',
    );
    const targets = rule?.targets?.(FAKE_MATCH, {
      clientId: '1000000000000000123',
    });
    expect(targets).toContain('/api/therapy/tasks/client/1000000000000000123');
  });
});

// Сообщение о бывшем терапевте (решение владельца 2026-10-22) зависит от живой
// связи: после подключения по коду и после отключения кеш обязан сброситься,
// иначе сообщение висит 15 секунд поверх нового «Мой терапевт».
describe('бывший терапевт: join и отключение сбрасывают сообщение', () => {
  const targetsOf = (method: string, path: string) => {
    const rule = RULES.find(
      (r) => r.method === method && r.pattern.test(path),
    )!;
    return rule.targets?.(path.match(rule.pattern)!, undefined) ?? [];
  };
  it.each([
    ['POST', '/api/therapy/join'],
    ['DELETE', '/api/therapy/relation'],
  ])('%s %s', (method, path) => {
    expect(targetsOf(method, path)).toEqual(
      expect.arrayContaining([
        '/api/therapy/relation',
        '/api/therapy/former-therapist',
      ]),
    );
  });
  // 2026-11-05: открытые задания бывшего терапевта становятся личными целями.
  it('отключение сбрасывает и задания клиента', () => {
    expect(targetsOf('DELETE', '/api/therapy/relation')).toContain(
      '/api/therapy/tasks',
    );
  });
});

// QA 2026-11, К1: сохранённый тест закрывает задание «пройти тест» от
// терапевта — список заданий не должен 15 секунд показывать его открытым.
describe('RULES: POST /api/ysq-result', () => {
  it('сбрасывает итог, историю, «Мой путь», профиль и задания', () => {
    const rule = RULES.find(
      (r) => r.method === 'POST' && r.pattern.test('/api/ysq-result'),
    );
    expect(rule?.targets?.(FAKE_MATCH, undefined)).toEqual([
      '/api/ysq-result',
      '/api/ysq-history',
      '/api/journey',
      '/api/profile',
      '/api/therapy/tasks',
      '/api/therapy/tasks/history',
    ]);
  });
});

// Кнопка «Удалить результаты теста» (решение владельца 2026-10-22) стирает
// итог, историю и прогресс: ни одна вкладка не должна ещё 15 секунд
// показывать удалённый тест из кеша.
describe('RULES: DELETE /api/ysq-data', () => {
  it('сбрасывает итог, историю, прогресс, «Мой путь» и профиль', () => {
    const rule = RULES.find(
      (r) => r.method === 'DELETE' && r.pattern.test('/api/ysq-data'),
    );
    expect(rule?.targets?.(FAKE_MATCH, undefined)).toEqual([
      '/api/ysq-result',
      { prefix: '/api/ysq-history' }, // и попытки по id («Мой путь», R6)
      '/api/ysq-progress',
      '/api/journey',
      '/api/profile',
    ]);
  });
});

// QA 2026-11 (B-З5): после теста «Мои паттерны» перечитывали профиль
// (ysq.activeSchemaIds), но 15 секунд получали его из кеша — без схем.
describe('RULES: итог YSQ сбрасывает профиль', () => {
  const targetsOf = (method: string) => {
    const rule = RULES.find(
      (r) => r.method === method && r.pattern.test('/api/ysq-result'),
    );
    return rule?.targets?.(FAKE_MATCH, undefined) ?? [];
  };
  it('POST /api/ysq-result — профиль, история и «Мой путь»', () => {
    expect(targetsOf('POST')).toEqual(
      expect.arrayContaining([
        '/api/profile',
        '/api/ysq-history',
        '/api/journey',
      ]),
    );
  });
  // «Пройти заново» итог не стирает (U8), ручки DELETE /api/ysq-result нет.
  it('DELETE /api/ysq-result — правила нет', () => {
    expect(targetsOf('DELETE')).toEqual([]);
  });
});

// R6 (аудит 2026-11): у записей появились GET …/:id («Мой путь») и страницы
// «Записей» (/api/diary/page/:kind) — отдельные ключи кеша. Запись или удаление
// обязаны сбросить и их, иначе удалённая запись ещё 15 секунд открывается, а
// правка письма показывает старый текст.
describe('RULES: запись по id и страницы дневника сбрасываются вместе со списком', () => {
  const targetsOf = (method: string, path: string) =>
    RULES.filter((r) => r.method === method && r.pattern.test(path)).flatMap(
      (r) => r.targets?.(FAKE_MATCH, undefined) ?? [],
    );
  const covers = (targets: InvalidationTarget[], key: string) =>
    targets.some((t) =>
      typeof t === 'string' ? t === key : key.startsWith(t.prefix),
    );

  it.each([
    [
      'POST',
      '/api/diary/schema',
      [
        '/api/diary/schema',
        '/api/diary/schema/31',
        '/api/diary/page/schema?before=9',
      ],
    ],
    [
      'DELETE',
      '/api/diary/mode/31',
      ['/api/diary/mode', '/api/diary/mode/31', '/api/diary/page/mode'],
    ],
    [
      'POST',
      '/api/diary/gratitude',
      ['/api/diary/gratitude/31', '/api/diary/page/gratitude'],
    ],
    ['PATCH', '/api/letters/31', ['/api/letters', '/api/letters/31']],
    [
      'DELETE',
      '/api/belief-checks/31',
      ['/api/belief-checks', '/api/belief-checks/31'],
    ],
    ['DELETE', '/api/flashcards/31', ['/api/flashcards', '/api/flashcards/31']],
  ])('%s %s', (method, path, keys) => {
    const targets = targetsOf(method, path);
    for (const key of keys) expect(covers(targets, key)).toBe(true);
  });

  it('контроль: дневник схем не сбрасывает чужой дневник', () => {
    const targets = targetsOf('POST', '/api/diary/schema');
    expect(covers(targets, '/api/diary/mode/31')).toBe(false);
    expect(covers(targets, '/api/diary/page/mode')).toBe(false);
  });
});
