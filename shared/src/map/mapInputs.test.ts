/**
 * Сборка входов карты из записей дневника и карточек.
 *
 * Главное, что проверяем, — честность признаков повтора: они решают только,
 * какую кнопку показать следующей, и не должны срабатывать на пустых полях
 * или на единственном случае. Ложный «повтор» превратился бы в обещание
 * паттерна, которого нет.
 */
import { describe, it, expect } from 'vitest';
import {
  buildMapInput,
  buildNextStepInput,
  noteHasCard,
  type CaseSource,
} from './mapInputs';

const TODAY = '2026-08-28';
const at = (n: number) =>
  new Date(Date.parse(TODAY) - n * 86400000).toISOString();

const wall = (n: number, over: Partial<CaseSource> = {}): CaseSource => ({
  modeId: 'detached_protector',
  createdAt: at(n),
  ...over,
});

describe('noteHasCard', () => {
  it('карточка считается собранной от одной приметы', () => {
    expect(noteHasCard({ modeId: 'x', triggers: 'не отвечают' })).toBe(true);
    expect(noteHasCard({ modeId: 'x', feelings: 'пусто' })).toBe(true);
    expect(noteHasCard({ modeId: 'x', behavior: 'ухожу в телефон' })).toBe(
      true,
    );
  });

  it('пустые и пробельные поля карточкой не считаются', () => {
    expect(noteHasCard({ modeId: 'x' })).toBe(false);
    expect(noteHasCard({ modeId: 'x', triggers: '   ' })).toBe(false);
  });

  it('одно только имя карточкой не делает — приметы ещё не собраны', () => {
    expect(noteHasCard({ modeId: 'x', alias: 'Стена' })).toBe(false);
  });
});

describe('buildMapInput', () => {
  it('переносит записи и карточки, имя берёт из карточки', () => {
    const input = buildMapInput(
      [wall(1)],
      [{ modeId: 'detached_protector', alias: 'Стена', triggers: 'тишина' }],
      false,
      [],
      TODAY,
    );
    expect(input.cases).toHaveLength(1);
    expect(input.notes[0]).toEqual({
      modeId: 'detached_protector',
      alias: 'Стена',
      hasCard: true,
    });
  });
});

describe('buildNextStepInput', () => {
  it('считает случаи по частям и помнит последний', () => {
    const out = buildNextStepInput([wall(1), wall(5)], [], false, TODAY);
    expect(out.caseCount).toBe(2);
    expect(out.modeStats[0].count).toBe(2);
    expect(out.modeStats[0].lastAt).toBe(at(1));
  });

  it('различает, кто на сцене, а кто за кулисами', () => {
    const out = buildNextStepInput(
      [wall(1), { modeId: 'vulnerable_child', createdAt: at(2) }],
      [],
      false,
      TODAY,
    );
    expect(out.hasCopingMode).toBe(true);
    expect(out.hasChildMode).toBe(true);
  });

  it('повтор части — только с третьего раза', () => {
    expect(
      buildNextStepInput([wall(1), wall(2)], [], false, TODAY).repeatedTrigger,
    ).toBe(false);
    expect(
      buildNextStepInput([wall(1), wall(2), wall(3)], [], false, TODAY)
        .repeatedTrigger,
    ).toBe(true);
  });

  it('пустые «что было нужно» повтором потребности не считаются', () => {
    const cases = [
      wall(1, { actualNeed: '   ' }),
      wall(2, { actualNeed: '' }),
      wall(3, { actualNeed: null }),
    ];
    expect(buildNextStepInput(cases, [], false, TODAY).repeatedNeed).toBe(
      false,
    );
  });

  it('трижды заполненное «что было нужно» — повтор', () => {
    const cases = [
      wall(1, { actualNeed: 'чтобы заметили' }),
      wall(2, { actualNeed: 'чтобы спросили' }),
      wall(3, { actualNeed: 'побыть рядом' }),
    ];
    expect(buildNextStepInput(cases, [], false, TODAY).repeatedNeed).toBe(true);
  });

  it('считает только заполненные ответы Здорового Взрослого', () => {
    const cases = [
      wall(1, { healthyResponse: 'Побудь, я рядом' }),
      wall(2, { healthyResponse: '  ' }),
      wall(3),
    ];
    expect(
      buildNextStepInput(cases, [], false, TODAY).healthyResponseCount,
    ).toBe(1);
  });

  it('на пустой истории ничего не выдумывает', () => {
    const out = buildNextStepInput([], [], false, TODAY);
    expect(out.caseCount).toBe(0);
    expect(out.modeStats).toEqual([]);
    expect(out.repeatedTrigger).toBe(false);
    expect(out.repeatedNeed).toBe(false);
  });
});
