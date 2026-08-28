// Тесты «что дальше» для карты себя: девять веток, порядок строгий — первая
// подошедшая побеждает, даже когда условиям отвечают сразу несколько.
import { describe, it, expect } from 'vitest';
import {
  caseNextStep,
  buildWhereIAm,
  type NextStepInput,
  type ModeStat,
} from './caseNextStep';
import { hasTyForms } from '../utils/tyFormsSweep';

const tyTr = (ty: string, _vy: string) => ty;
const vyTr = (_ty: string, vy: string) => vy;

// JS \b не считает кириллицу «буквой» (см. shared/src/flashcard/modes.test.ts)
// — «ты»-сторону проверяем готовым hasTyForms, «вы»-сторону — тем же
// приёмом lookaround локально.
const NOT_CYR = '(?![а-яёА-ЯЁ])';
const NOT_CYR_BEFORE = '(?<![а-яёА-ЯЁ])';
const VY_MARKERS = new RegExp(`${NOT_CYR_BEFORE}[Вв]ы${NOT_CYR}|[Вв]ам|[Вв]аш`);

const mode = (over: Partial<ModeStat> = {}): ModeStat => ({
  modeId: 'punitive_critic',
  count: 1,
  hasCard: false,
  lastAt: '2026-08-01',
  ...over,
});

const input = (over: Partial<NextStepInput> = {}): NextStepInput => ({
  caseCount: 0,
  modeStats: [],
  hasChildMode: false,
  hasCopingMode: false,
  healthyResponseCount: 0,
  repeatedTrigger: false,
  repeatedNeed: false,
  ysqDone: false,
  today: '2026-08-28',
  ...over,
});

describe('caseNextStep — девять веток', () => {
  it('1. пустая карта → «Разобрать случай» с пустым хинтом', () => {
    const v = caseNextStep(input({ caseCount: 0 }), tyTr);
    expect(v.id).toBe('first_case');
    expect(v.label).toBe('Разобрать случай');
    expect(v.hint).toBe('Карта пустая. Первый разбор поставит первую метку.');
  });

  it('2. один режим и один случай → «Разобрать ещё один случай»', () => {
    const v = caseNextStep(
      input({ caseCount: 1, modeStats: [mode({ count: 1 })] }),
      tyTr,
    );
    expect(v.id).toBe('another_case');
    expect(v.label).toBe('Разобрать ещё один случай');
  });

  it('3. режим повторился без карточки → «Собрать приметы: имя» · ≈2 мин', () => {
    const v = caseNextStep(
      input({
        caseCount: 2,
        modeStats: [
          mode({ modeId: 'punitive_critic', count: 2, hasCard: false }),
        ],
      }),
      tyTr,
    );
    expect(v.id).toBe('build_card');
    expect(v.time).toBe('≈ 2 мин');
    expect(v.label).toMatch(/^Собрать приметы: /);
  });

  it('4. копинг без детского режима → «Разобрать, кто стоит за имя» · 3 мин', () => {
    const v = caseNextStep(
      input({
        caseCount: 2,
        modeStats: [
          mode({ modeId: 'detached_protector', count: 1, hasCard: true }),
        ],
        hasCopingMode: true,
        hasChildMode: false,
      }),
      tyTr,
    );
    expect(v.id).toBe('coping_child');
    expect(v.time).toBe('3 мин');
    expect(v.label).toMatch(/^Разобрать, кто стоит за /);
  });

  it('5. три+ разбора без ответа Здорового Взрослого → «Ответить: имя»', () => {
    const v = caseNextStep(
      input({
        caseCount: 3,
        modeStats: [
          mode({ modeId: 'punitive_critic', count: 1, hasCard: true }),
        ],
        healthyResponseCount: 0,
      }),
      tyTr,
    );
    expect(v.id).toBe('healthy_response');
    expect(v.label).toMatch(/^Ответить: /);
  });

  it('6. пять+ разборов, повторный триггер, тест не пройден → «Пройти тест на схемы»', () => {
    const v = caseNextStep(
      input({
        caseCount: 5,
        modeStats: [mode({ count: 1, hasCard: true })],
        healthyResponseCount: 1,
        repeatedTrigger: true,
        ysqDone: false,
      }),
      tyTr,
    );
    expect(v.id).toBe('ysq_test');
    expect(v.label).toBe('Пройти тест на схемы');
  });

  it('7. потребность повторилась → «Посмотреть потребности за неделю»', () => {
    const v = caseNextStep(
      input({
        caseCount: 5,
        modeStats: [mode({ count: 1, hasCard: true })],
        healthyResponseCount: 1,
        repeatedTrigger: false,
        repeatedNeed: true,
      }),
      tyTr,
    );
    expect(v.id).toBe('needs_week');
  });

  it('8. всё тронуто, история накопилась → «Перечитать карту»', () => {
    const v = caseNextStep(
      input({
        caseCount: 6,
        modeStats: [mode({ count: 1, hasCard: true })],
        healthyResponseCount: 1,
        repeatedTrigger: false,
        repeatedNeed: false,
        ysqDone: true,
      }),
      tyTr,
    );
    expect(v.id).toBe('reread_map');
    expect(v.label).toBe('Перечитать карту — что изменилось за месяц');
  });

  it('9. фолбэк (мало истории, ничего не подошло) — тот же вид, что ветка 1', () => {
    const v = caseNextStep(
      input({
        caseCount: 2,
        modeStats: [
          mode({ count: 1, hasCard: true }),
          mode({ modeId: 'lonely_child', count: 1, hasCard: true }),
        ],
      }),
      tyTr,
    );
    expect(v.id).toBe('first_case');
    expect(v.label).toBe('Разобрать случай');
    expect(v.hint).toBe('Карта пустая. Первый разбор поставит первую метку.');
  });
});

describe('caseNextStep — порядок веток', () => {
  it('условия веток 1 и 3 разом — побеждает более ранняя (1)', () => {
    // caseCount 0 формально не может нести modeStats с count>=2 в реальном
    // потоке, но порядок обязан быть железным вне зависимости от того, что
    // «реалистично» — гейт целостности, а не жизненный сценарий.
    const v = caseNextStep(
      input({
        caseCount: 0,
        modeStats: [mode({ count: 5, hasCard: false })],
      }),
      tyTr,
    );
    expect(v.id).toBe('first_case');
  });

  it('условия веток 3 и 4 разом — побеждает более ранняя (3)', () => {
    const v = caseNextStep(
      input({
        caseCount: 4,
        modeStats: [
          mode({ modeId: 'detached_protector', count: 2, hasCard: false }),
        ],
        hasCopingMode: true,
        hasChildMode: false,
      }),
      tyTr,
    );
    expect(v.id).toBe('build_card');
  });

  it('условия веток 6 и 7 разом — побеждает более ранняя (6)', () => {
    const v = caseNextStep(
      input({
        caseCount: 5,
        modeStats: [mode({ count: 1, hasCard: true })],
        healthyResponseCount: 1,
        repeatedTrigger: true,
        repeatedNeed: true,
        ysqDone: false,
      }),
      tyTr,
    );
    expect(v.id).toBe('ysq_test');
  });

  it('условия веток 7 и 8 разом — побеждает более ранняя (7)', () => {
    const v = caseNextStep(
      input({
        caseCount: 6,
        modeStats: [mode({ count: 1, hasCard: true })],
        healthyResponseCount: 1,
        repeatedTrigger: false,
        repeatedNeed: true,
        ysqDone: true,
      }),
      tyTr,
    );
    expect(v.id).toBe('needs_week');
  });
});

describe('caseNextStep — имя режима', () => {
  it('alias побеждает клиническое имя', () => {
    const v = caseNextStep(
      input({
        caseCount: 2,
        modeStats: [
          mode({
            modeId: 'punitive_critic',
            alias: 'Стена',
            count: 2,
            hasCard: false,
          }),
        ],
      }),
      tyTr,
    );
    expect(v.label).toBe('Собрать приметы: Стена');
  });

  it('без alias — человеческая фраза режима, не «сырой» modeId', () => {
    const v = caseNextStep(
      input({
        caseCount: 2,
        modeStats: [
          mode({ modeId: 'punitive_critic', count: 2, hasCard: false }),
        ],
      }),
      tyTr,
    );
    expect(v.label).not.toContain('punitive_critic');
  });

  it('незнакомый modeId без alias — фолбэк на сам modeId', () => {
    const v = caseNextStep(
      input({
        caseCount: 2,
        modeStats: [
          mode({ modeId: 'totally_unknown_mode', count: 2, hasCard: false }),
        ],
      }),
      tyTr,
    );
    expect(v.label).toBe('Собрать приметы: totally_unknown_mode');
  });
});

describe('caseNextStep — ysq_test хинт: форма обращения', () => {
  const ysqInput = input({
    caseCount: 5,
    modeStats: [mode({ count: 1, hasCard: true })],
    healthyResponseCount: 1,
    repeatedTrigger: true,
    ysqDone: false,
  });

  it('«ты»-выдача не содержит вы/вам/ваш', () => {
    const v = caseNextStep(ysqInput, tyTr);
    expect(v.hint).not.toMatch(VY_MARKERS);
  });

  it('«вы»-выдача не содержит голых ты/тебя/твой', () => {
    const v = caseNextStep(ysqInput, vyTr);
    expect(hasTyForms(v.hint ?? '')).toBe(false);
  });
});

describe('buildWhereIAm', () => {
  it('пустое состояние — фраза про пустую карту, не голый счётчик', () => {
    const text = buildWhereIAm(input({ caseCount: 0 }), tyTr);
    expect(text).toBe('Карта пустая. Первый разбор поставит первую метку.');
    expect(text).not.toMatch(/^\d/);
  });

  it('один случай — имя режима, без голого числа в начале', () => {
    const text = buildWhereIAm(
      input({
        caseCount: 1,
        modeStats: [mode({ modeId: 'punitive_critic', count: 1 })],
      }),
      tyTr,
    );
    expect(text).toContain('Один случай');
    expect(text).not.toContain('punitive_critic');
  });

  it('повтор — видно частоту режима относительно всех разборов', () => {
    const text = buildWhereIAm(
      input({
        caseCount: 6,
        modeStats: [
          mode({
            modeId: 'punitive_critic',
            alias: 'Критик',
            count: 4,
            lastAt: '2026-08-20',
          }),
          mode({ modeId: 'lonely_child', count: 2, lastAt: '2026-08-10' }),
        ],
      }),
      tyTr,
    );
    expect(text).toContain('Критик');
    expect(text).toContain('4 из 6');
  });

  it('повтор — «ты»-выдача не содержит вы/вам/ваш', () => {
    const text = buildWhereIAm(
      input({
        caseCount: 6,
        modeStats: [mode({ alias: 'Критик', count: 4 })],
      }),
      tyTr,
    );
    expect(text).not.toMatch(VY_MARKERS);
  });

  it('повтор — «вы»-выдача не содержит голых ты/тебя/твой', () => {
    const text = buildWhereIAm(
      input({
        caseCount: 6,
        modeStats: [mode({ alias: 'Критик', count: 4 })],
      }),
      vyTr,
    );
    expect(hasTyForms(text)).toBe(false);
  });
});
