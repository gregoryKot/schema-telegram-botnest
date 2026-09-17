// Тест гейта check-feature-parity.mjs (правило №3 CLAUDE.md, расследование
// 2026-08-21: PhraseCheck-упражнение, DiaryShareButton и .ics-экспорт жили
// только в мини-аппе, ни один гейт этого не заметил — check-paired-files.mjs
// видит только файлы из жёсткого списка PAIRS, check-dead-files.mjs считает
// единицей учёта файл, а не метод внутри него).
//
// Источник истины — роуты контроллеров src/api/**/*.controller.ts; фикстуры
// ниже используют один контроллер ThingsController с четырьмя роутами и
// варьируют, что реально дёргают webapp/schema-miniapp/shared.
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate, REAL_SCRIPTS_DIR } from './gate-sandbox';

const REAL_BASELINE = join(
  __dirname,
  '..',
  '..',
  '..',
  'scripts',
  'feature-parity-baseline.json',
);

const CONTROLLER = [
  "import { Controller, Get, Post, Delete, Patch } from '@nestjs/common';",
  '',
  "@Controller('api')",
  'export class ThingsController {',
  "  @Get('things')",
  '  list() {}',
  '',
  "  @Post('things')",
  '  create() {}',
  '',
  "  @Delete('things/:id')",
  '  remove() {}',
  '',
  "  @Patch('things/:id')",
  '  update() {}',
  '}',
  '',
].join('\n');

// Только GET/POST — для тестов, где DELETE/PATCH намеренно не участвуют
// (иначе им бы тоже потребовалась запись в бейслайне: у ThingsController их
// объявлено четыре, а не два).
const SIMPLE_CONTROLLER = [
  "import { Controller, Get, Post } from '@nestjs/common';",
  '',
  "@Controller('api')",
  'export class ThingsController {',
  "  @Get('things')",
  '  list() {}',
  '',
  "  @Post('things')",
  '  create() {}',
  '}',
  '',
].join('\n');

// Обёртки get/post/del — как в webapp/src/api.ts (правило: тот же вызывающий
// код, что в проде, никаких упрощённых копий).
const WRAPPERS = [
  'function get(path) { return fetch(path); }',
  "function post(path, body) { return fetch(path, { method: 'POST', body }); }",
  "function patchJson(path, body) { return fetch(path, { method: 'PATCH', body }); }",
  "function del(path) { return fetch(path, { method: 'DELETE' }); }",
  '',
].join('\n');

// Клиент, где ОБЪЯВЛЕНЫ и РЕАЛЬНО ВЫЗЫВАЮТСЯ (за пределами api.ts) getThings
// и createThing — used-статус для GET/POST /api/things.
function fullClient(tree: 'webapp' | 'schema-miniapp') {
  return {
    [`${tree}/src/api.ts`]: [
      WRAPPERS,
      'export const api = {',
      "  getThings: () => get('/api/things'),",
      "  createThing: (body) => post('/api/things', body),",
      '};',
      '',
    ].join('\n'),
    [`${tree}/src/ThingsList.ts`]: [
      "import { api } from './api';",
      'export function loadThings() { return api.getThings(); }',
      'export function addThing(body) { return api.createThing(body); }',
      '',
    ].join('\n'),
  };
}

// Клиент, где deleteThing/updateThing ОБЪЯВЛЕНЫ, но не вызваны нигде за
// пределами объявления — та же форма, что реальный deleteBeliefCheck.
function orphanDeclarations(tree: 'webapp' | 'schema-miniapp') {
  return {
    [`${tree}/src/apiExtra.ts`]: [
      "import { del, patchJson } from './api';",
      'export const extra = {',
      '  deleteThing: (id) => del(`/api/things/${id}`),',
      '  updateThing: (id, body) => patchJson(`/api/things/${id}`, body),',
      '};',
      '',
    ].join('\n'),
  };
}

function files(...parts: Record<string, string>[]) {
  return Object.assign(
    { 'src/api/things.controller.ts': CONTROLLER },
    ...parts,
  );
}

describe('check-feature-parity.mjs', () => {
  it('оба фронтенда реально дёргают все роуты — exit 0, без бейслайна', () => {
    const res = runGate('check-feature-parity.mjs', {
      'src/api/things.controller.ts': SIMPLE_CONTROLLER,
      ...fullClient('webapp'),
      ...fullClient('schema-miniapp'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт паритета фич');
  });

  it('новый односторонний роут без записи в бейслайне — exit 1', () => {
    // DELETE только в webapp (объявлен И вызван), miniapp его не знает вовсе.
    const res = runGate(
      'check-feature-parity.mjs',
      files(
        fullClient('webapp'),
        fullClient('schema-miniapp'),
        orphanDeclarations('webapp'),
        {
          // Реальный вызывающий для deleteThing — иначе это был бы 'nobody', не 'webapp-only'.
          'webapp/src/ThingsAdmin.ts': [
            "import { extra } from './apiExtra';",
            'export function remove(id) { return extra.deleteThing(id); }',
            '',
          ].join('\n'),
        },
      ),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('роуты без записи в бейслайне');
    expect(res.stderr).toContain('DELETE /api/things/:param  [webapp-only]');
  });

  // Ядро гейта: объявление метода в api-объекте САМО ПО СЕБЕ не значит
  // «доступно» — deleteBeliefCheck/deleteFlashcard/deleteLetter объявлены в
  // обоих фронтендах и не вызываются НИГДЕ, кроме тестов. Без этой проверки
  // гейт был бы вечнозелёным по всем трём.
  it('роут объявлен в обоих клиентах, но не вызван нигде — nobody, exit 1', () => {
    const res = runGate(
      'check-feature-parity.mjs',
      files(
        fullClient('webapp'),
        fullClient('schema-miniapp'),
        orphanDeclarations('webapp'),
        orphanDeclarations('schema-miniapp'),
      ),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('DELETE /api/things/:param  [nobody]');
    expect(res.stderr).toContain('PATCH /api/things/:param  [nobody]');
  });

  // Зеркало прошлого теста: метод не объявлен ни в объекте-обёртке (нет
  // соседнего `key: (`), а вызван напрямую (как authedFetch в
  // useUserFlags.ts / rawSaveRating в ratingApi.ts) — считается используемым
  // сразу, без проверки «упомянут ли ещё раз».
  it('прямой inline-вызов без объекта-обёртки — используется сразу, не nobody', () => {
    const res = runGate('check-feature-parity.mjs', {
      'src/api/things.controller.ts': CONTROLLER,
      'webapp/src/hook.ts': [
        'export async function doIt() {',
        "  const res = await fetch('/api/things', { method: 'GET' });",
        '  return res.json();',
        '}',
        '',
      ].join('\n'),
      'schema-miniapp/src/hook.ts': [
        'export async function doIt() {',
        "  const res = await fetch('/api/things', { method: 'GET' });",
        '  return res.json();',
        '}',
        '',
      ].join('\n'),
      'scripts/feature-parity-baseline.json': JSON.stringify({
        'POST /api/things': {
          status: 'nobody',
          reason: 'фикстура: POST нигде не вызывается',
          since: 'fixture',
        },
        'DELETE /api/things/:param': {
          status: 'nobody',
          reason: 'фикстура: DELETE нигде не вызывается',
          since: 'fixture',
        },
        'PATCH /api/things/:param': {
          status: 'nobody',
          reason: 'фикстура: PATCH нигде не вызывается',
          since: 'fixture',
        },
      }),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт паритета фич');
  });

  // Общий хук с прокинутыми зависимостями (реальный случай: getPhraseChecks
  // вызывается из shared/src/warmWords/useWarmWords.ts, а не напрямую из
  // webapp/miniapp) — shared credits обеим площадкам, и ссылки на имя поля
  // БЕЗ прямого вызова через `.imя(` тоже считаются использованием.
  it('роут, используемый только через shared-хук с DI, засчитан обеим площадкам', () => {
    const res = runGate('check-feature-parity.mjs', {
      'src/api/things.controller.ts': CONTROLLER,
      'webapp/src/api.ts': [
        WRAPPERS,
        'export const api = {',
        "  getThings: () => get('/api/things'),",
        "  createThing: (body) => post('/api/things', body),",
        '};',
        '',
      ].join('\n'),
      'schema-miniapp/src/api.ts': [
        WRAPPERS,
        'export const api = {',
        "  getThings: () => get('/api/things'),",
        "  createThing: (body) => post('/api/things', body),",
        '};',
        '',
      ].join('\n'),
      // Оба фронта передают весь `api`-объект в общий хук, не вызывая
      // getThings/createThing напрямую сами.
      'webapp/src/UseThings.ts':
        "import { api } from './api';\nimport { useThings } from '../../shared/src/useThings';\nuseThings(api);\n",
      'schema-miniapp/src/UseThings.ts':
        "import { api } from './api';\nimport { useThings } from '../../shared/src/useThings';\nuseThings(api);\n",
      'shared/src/useThings.ts': [
        'export function useThings(deps) {',
        '  return deps.getThings().then(() => deps.createThing({}));',
        '}',
        '',
      ].join('\n'),
      'scripts/feature-parity-baseline.json': JSON.stringify({
        'DELETE /api/things/:param': {
          status: 'nobody',
          reason: 'фикстура: роут не реализован клиентом вовсе',
          since: 'fixture',
        },
        'PATCH /api/things/:param': {
          status: 'nobody',
          reason: 'фикстура: роут не реализован клиентом вовсе',
          since: 'fixture',
        },
      }),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт паритета фич');
  });

  it('причина в бейслайне короче 20 символов — exit 1', () => {
    const res = runGate(
      'check-feature-parity.mjs',
      files(
        fullClient('webapp'),
        fullClient('schema-miniapp'),
        orphanDeclarations('webapp'),
        {
          'webapp/src/ThingsAdmin.ts':
            "import { extra } from './apiExtra';\nexport function remove(id) { return extra.deleteThing(id); }\n",
          'scripts/feature-parity-baseline.json': JSON.stringify({
            'DELETE /api/things/:param': {
              status: 'webapp-only',
              reason: 'коротко',
              since: 'abc1234',
            },
          }),
        },
      ),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('исключение без внятной причины');
    expect(res.stderr).toContain('DELETE /api/things/:param');
  });

  it('запись бейслайна без `since` — exit 1', () => {
    const res = runGate(
      'check-feature-parity.mjs',
      files(
        fullClient('webapp'),
        fullClient('schema-miniapp'),
        orphanDeclarations('webapp'),
        {
          'webapp/src/ThingsAdmin.ts':
            "import { extra } from './apiExtra';\nexport function remove(id) { return extra.deleteThing(id); }\n",
          'scripts/feature-parity-baseline.json': JSON.stringify({
            'DELETE /api/things/:param': {
              status: 'webapp-only',
              reason: 'осознанная причина длиннее двадцати символов',
              since: '',
            },
          }),
        },
      ),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('исключение без `since`');
    expect(res.stderr).toContain('DELETE /api/things/:param');
  });

  it('протухшая запись: паритет уже достигнут — exit 1', () => {
    // Бейслайн утверждает webapp-only, а на деле оба фронта дёргают роут.
    const res = runGate(
      'check-feature-parity.mjs',
      files(fullClient('webapp'), fullClient('schema-miniapp'), {
        'scripts/feature-parity-baseline.json': JSON.stringify({
          'GET /api/things': {
            status: 'webapp-only',
            reason: 'осознанная причина длиннее двадцати символов',
            since: 'abc1234',
          },
        }),
      }),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухшие записи бейслайна');
    expect(res.stderr).toContain('GET /api/things');
  });

  it('протухшая запись: роут исчез из бэкенда — exit 1', () => {
    const res = runGate(
      'check-feature-parity.mjs',
      files(fullClient('webapp'), fullClient('schema-miniapp'), {
        'scripts/feature-parity-baseline.json': JSON.stringify({
          'GET /api/ghost': {
            status: 'nobody',
            reason: 'роут когда-то существовал, теперь удалён из контроллера',
            since: 'abc1234',
          },
        }),
      }),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухшие записи бейслайна');
    expect(res.stderr).toContain('GET /api/ghost');
  });

  // Правило №15: у записи бейслайна есть образец, который она гасит, И
  // похожий незадокументированный случай остаётся красным — запись не
  // расширяется молча на весь класс проблемы.
  it('запись гасит только свой роут; похожий недокументированный — по-прежнему exit 1', () => {
    const res = runGate(
      'check-feature-parity.mjs',
      files(
        fullClient('webapp'),
        fullClient('schema-miniapp'),
        orphanDeclarations('webapp'),
        orphanDeclarations('schema-miniapp'),
        {
          // Только DELETE задокументирован; PATCH — тот же класс (nobody),
          // но без записи.
          'scripts/feature-parity-baseline.json': JSON.stringify({
            'DELETE /api/things/:param': {
              status: 'nobody',
              reason: 'осознанная причина длиннее двадцати символов',
              since: 'abc1234',
            },
          }),
        },
      ),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).not.toContain('DELETE /api/things/:param  [nobody]');
    expect(res.stderr).toContain('PATCH /api/things/:param  [nobody]');
  });
});

// Реестр (scripts/feature-parity-baseline.json) — не ALLOW/EXCLUDE-массив
// внутри самого скрипта (значения объектные, не числовые — обычный
// merge=ratchet-min сюда не подходит, файл намеренно оставлен на обычном
// текстовом слиянии git, см. коммит, добавивший гейт), поэтому формально не
// под check-gate-exemptions.mjs; тест ниже держит реестр честным сам по себе
// — правило №13 (отсортирован) и содержательность каждой записи.
describe('scripts/feature-parity-baseline.json соответствует своим правилам', () => {
  it('каждая запись — с status/reason/since, ключи отсортированы', () => {
    const baseline = JSON.parse(readFileSync(REAL_BASELINE, 'utf8')) as Record<
      string,
      { status: string; reason: string; since: string }
    >;
    const keys = Object.keys(baseline);
    expect(keys).toEqual([...keys].sort());
    for (const [key, v] of Object.entries(baseline)) {
      if (v.reason.length < 20) throw new Error(`${key}: reason too short`);
      if (!v.since) throw new Error(`${key}: since missing`);
      expect(['webapp-only', 'miniapp-only', 'nobody']).toContain(v.status);
    }
  });
});

// Правило №10: движок check-feature-parity.mjs раздроблен на движок + модуль
// правил feature-parity-patterns.mjs. check-unwatched-code.mjs требует, чтобы
// у каждого исполняемого файла в scripts/ был тест, упоминающий его по имени
// (не в комментарии) — сам движок упомянут через runGate() выше, эта
// проверка закрывает вторую половину дробления и заодно фиксирует, что
// раздел не расползётся молча.
describe('дробление движок + модуль правил', () => {
  it('check-feature-parity.mjs импортирует feature-parity-patterns.mjs', () => {
    const engineSrc = readFileSync(
      join(REAL_SCRIPTS_DIR, 'check-feature-parity.mjs'),
      'utf8',
    );
    expect(engineSrc).toContain("from './feature-parity-patterns.mjs'");
  });
});
