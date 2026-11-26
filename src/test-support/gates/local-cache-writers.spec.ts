// Тест гейта check-local-cache-writers.mjs — «один ключ localStorage — один
// писатель» во фронтенде (webapp/src, shared/src).
//
// Класс инцидента 2026-11-05 (PR #935): кэш контакта терапевта писали два
// места, третье меняло источник правды на сервере и кэш не трогало — «кэш
// пережил источник правды». Гейт требует классификации каждого ключа в
// scripts/local-cache-baseline.json (владелец, mirror|local) и краснеет на
// втором писателе, ключе без записи и протухшей записи.
//
// Проверяются оба исхода (правило CLAUDE.md про тесты гейтов) плюс
// контрольные образцы (правило №15): писатель через функцию-движок, ключ,
// пришедший параметром, — всё, что могло бы молча пройти мимо.
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate } from './gate-sandbox';

const SCRIPT = 'check-local-cache-writers.mjs';
const REAL_BASELINE = join(
  __dirname,
  '..',
  '..',
  '..',
  'scripts',
  'local-cache-baseline.json',
);

type Entry = { owner: string; kind: 'mirror' | 'local'; source?: string };
type Engine = { functions: string[]; reason: string };
const REASON = 'ключ приходит от вызывающего, обёртка общая на все ключи';

function baseline(
  keys: Record<string, Entry>,
  engines: Record<string, Engine> = {},
) {
  return {
    'scripts/local-cache-baseline.json': JSON.stringify({ keys, engines }),
  };
}

const OWNER = [
  "const KEY = 'my_thing';",
  'export function cacheThing(v: string) { localStorage.setItem(KEY, v); }',
  'export function dropThing() { localStorage.removeItem(KEY); }',
  '',
].join('\n');

describe('check-local-cache-writers.mjs', () => {
  it('чистое дерево: владелец пишет, потребитель зовёт его функцию, mirror с source — exit 0', () => {
    const res = runGate(SCRIPT, {
      'webapp/src/thing.ts': OWNER,
      'webapp/src/consumer.ts':
        "import { cacheThing } from './thing';\nexport const f = () => cacheThing('1');\n",
      // динамическое семейство через функцию-строитель и импортированную константу
      'shared/src/keys.ts':
        "export const DAY_KEY = (d: string) => 'celebrated_' + d;\nexport const TAB = 'last_tab';\n",
      'shared/src/day.ts':
        "import { DAY_KEY, TAB } from './keys';\nexport const mark = (d: string) => { localStorage.setItem(DAY_KEY(d), '1'); localStorage.setItem(TAB, 'x'); };\n",
      ...baseline({
        my_thing: {
          owner: 'webapp/src/thing.ts',
          kind: 'mirror',
          source: 'User.thing (api.getProfile)',
        },
        'celebrated_*': { owner: 'shared/src/day.ts', kind: 'local' },
        last_tab: { owner: 'shared/src/day.ts', kind: 'local' },
      }),
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(
      '✓ гейт владельцев кэша localStorage: 3 ключей',
    );
  });

  // Ядро гейта: тот самый инцидент — второй файл пишет тот же ключ напрямую.
  it('второй писатель того же ключа — exit 1, оба файла в отчёте', () => {
    const res = runGate(SCRIPT, {
      'webapp/src/thing.ts': OWNER,
      'webapp/src/settings.ts':
        "export const reset = () => localStorage.removeItem('my_thing');\n",
      ...baseline({
        my_thing: { owner: 'webapp/src/thing.ts', kind: 'local' },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'my_thing: второй писатель webapp/src/settings.ts:1 (владелец webapp/src/thing.ts)',
    );
  });

  // Контрольный образец: запись через функцию-движок (writeLocal) — тоже
  // запись, писателем считается вызывающий файл, а не обёртка.
  it('второй писатель через функцию-движок — по-прежнему exit 1', () => {
    const res = runGate(SCRIPT, {
      'webapp/src/thing.ts': OWNER,
      'shared/src/utils/safe.ts':
        'export function writeLocal(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* */ } }\n',
      'webapp/src/other.ts':
        "import { writeLocal } from '../../shared/src/utils/safe';\nexport const g = () => writeLocal('my_thing', '0');\n",
      ...baseline(
        { my_thing: { owner: 'webapp/src/thing.ts', kind: 'local' } },
        {
          'shared/src/utils/safe.ts': {
            functions: ['writeLocal'],
            reason: REASON,
          },
        },
      ),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'my_thing: второй писатель webapp/src/other.ts:2',
    );
  });

  it('ключ движка во втором аргументе (fn#1) и в поле объекта (fn#prop) — находится', () => {
    const res = runGate(SCRIPT, {
      'shared/src/engine.ts': [
        'export function useBlocks(screen: string, storageKey: string) { localStorage.setItem(storageKey, screen); }',
        'export function useOrder({ storageKey }: { storageKey: string }) { localStorage.removeItem(storageKey); }',
        '',
      ].join('\n'),
      'shared/src/screen.ts': [
        "import { useBlocks, useOrder } from './engine';",
        "const KEYS = { profile: 'hidden_profile', patterns: 'hidden_patterns' } as const;",
        'export const a = (s: keyof typeof KEYS) => useBlocks(s, KEYS[s]);',
        "export const b = () => useOrder({ storageKey: 'order_today' });",
        '',
      ].join('\n'),
      ...baseline(
        {
          hidden_profile: { owner: 'shared/src/screen.ts', kind: 'local' },
          hidden_patterns: { owner: 'shared/src/screen.ts', kind: 'local' },
          order_today: { owner: 'shared/src/screen.ts', kind: 'local' },
        },
        {
          'shared/src/engine.ts': {
            functions: ['useBlocks#1', 'useOrder#storageKey'],
            reason: REASON,
          },
        },
      ),
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('ключ без записи в реестре — exit 1, писатель назван', () => {
    const res = runGate(SCRIPT, {
      'webapp/src/thing.ts': OWNER,
      ...baseline({}),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'my_thing: ключ без записи в реестре; пишут: webapp/src/thing.ts:2',
    );
  });

  it('протухшая запись: ключ в коде никто не пишет — exit 1', () => {
    const res = runGate(SCRIPT, {
      'webapp/src/thing.ts': 'export const nothing = 1;\n',
      ...baseline({
        my_thing: { owner: 'webapp/src/thing.ts', kind: 'local' },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('my_thing: протухшая запись');
  });

  it('владелец из реестра сам не пишет, пишет другой файл — exit 1', () => {
    const res = runGate(SCRIPT, {
      'webapp/src/thing.ts': OWNER,
      ...baseline({
        my_thing: { owner: 'webapp/src/owner.ts', kind: 'local' },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'my_thing: владелец webapp/src/owner.ts сам не пишет ключ; пишут: webapp/src/thing.ts',
    );
  });

  it('mirror без source и неизвестный kind — exit 1', () => {
    const res = runGate(SCRIPT, {
      'webapp/src/thing.ts': OWNER,
      'webapp/src/tab.ts':
        "export const t = () => localStorage.setItem('last_tab', '1');\n",
      ...baseline({
        my_thing: { owner: 'webapp/src/thing.ts', kind: 'mirror' },
        last_tab: { owner: 'webapp/src/tab.ts', kind: 'cache' as 'local' },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('my_thing: mirror без source');
    expect(res.stderr).toContain('last_tab: kind «cache»');
  });

  // Пара образцов для неразрешимого ключа: в обычном файле — красное (иначе
  // любой `setItem(key)` с параметром уходил бы мимо гейта), в объявленном
  // движке — норма.
  it('ключ параметром в обычном файле — exit 1; тот же файл как движок — exit 0', () => {
    const files = {
      'shared/src/wrap.ts':
        'export function put(key: string) { localStorage.setItem(key, "1"); }\n',
      'shared/src/user.ts':
        "import { put } from './wrap';\nexport const u = () => put('flag');\n",
    };
    const red = runGate(SCRIPT, { ...files, ...baseline({}) });
    expect(red.status).toBe(1);
    expect(red.stderr).toContain(
      'shared/src/wrap.ts:1: ключ не разрешается статически',
    );

    const green = runGate(SCRIPT, {
      ...files,
      ...baseline(
        { flag: { owner: 'shared/src/user.ts', kind: 'local' } },
        { 'shared/src/wrap.ts': { functions: ['put'], reason: REASON } },
      ),
    });
    expect(green.stderr).toBe('');
    expect(green.status).toBe(0);
  });

  it('движок без неразрешимых записей, с короткой причиной или с чужой функцией — exit 1', () => {
    const res = runGate(SCRIPT, {
      'webapp/src/thing.ts': OWNER,
      ...baseline(
        { my_thing: { owner: 'webapp/src/thing.ts', kind: 'local' } },
        { 'webapp/src/thing.ts': { functions: ['nope'], reason: 'legacy' } },
      ),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'движок webapp/src/thing.ts: причина короче 20 символов',
    );
    expect(res.stderr).toContain(
      'движок webapp/src/thing.ts: функция nope в файле не объявлена',
    );
    expect(res.stderr).toContain(
      'движок webapp/src/thing.ts: ни одной записи с ключом от вызывающего',
    );
  });

  it('константа через реэкспорт `export * from` и объект `KEYS[type]` — разрешаются', () => {
    const res = runGate(SCRIPT, {
      'shared/src/keys.ts':
        "export const DRAFT_KEYS = { a: 'draft_a', b: 'draft_b' };\n",
      'webapp/src/keys.ts': "export * from '../../shared/src/keys';\n",
      'webapp/src/drafts.ts': [
        "import { DRAFT_KEYS } from './keys';",
        "export function save(t: 'a' | 'b') { localStorage.setItem(DRAFT_KEYS[t], '{}'); }",
        '',
      ].join('\n'),
      ...baseline({
        draft_a: { owner: 'webapp/src/drafts.ts', kind: 'local' },
        draft_b: { owner: 'webapp/src/drafts.ts', kind: 'local' },
      }),
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('тесты и test-helpers не считаются писателями', () => {
    const res = runGate(SCRIPT, {
      'webapp/src/thing.ts': OWNER,
      'webapp/src/thing.test.ts': "localStorage.setItem('my_thing', 'x');\n",
      'webapp/src/Sheet.test-helpers.tsx':
        "localStorage.setItem('my_thing', 'y');\n",
      ...baseline({
        my_thing: { owner: 'webapp/src/thing.ts', kind: 'local' },
      }),
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('реестр репозитория: у каждой записи владелец и kind, у mirror — source', () => {
    const real = JSON.parse(readFileSync(REAL_BASELINE, 'utf8')) as {
      keys: Record<string, Entry>;
      engines: Record<string, Engine>;
    };
    for (const [key, e] of Object.entries(real.keys)) {
      expect(e.owner).toMatch(/^(webapp|shared)\/src\//);
      expect(['mirror', 'local']).toContain(e.kind);
      if (e.kind === 'mirror')
        expect(String(e.source).length).toBeGreaterThanOrEqual(10);
      expect(key).not.toMatch(/\s/);
    }
    for (const e of Object.values(real.engines))
      expect(e.reason.length).toBeGreaterThanOrEqual(20);
    // Зеркала серверного состояния из инцидента — в реестре и с одним владельцем.
    expect(real.keys.therapy_contact_url.kind).toBe('mirror');
    expect(real.keys.my_schema_ids.owner).toBe(real.keys.my_mode_ids.owner);
  });
});
