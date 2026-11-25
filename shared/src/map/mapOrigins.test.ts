import { describe, it, expect } from 'vitest';
import { buildOrigins, originSub } from './mapOrigins';
import { ALL_SCHEMAS } from '../schemaTherapy/schemaTherapyData';

const [A, B, C] = ALL_SCHEMAS.map((s) => s.id);
const view = (
  ysqSchemaIds: string[],
  manualSchemaIds: string[],
  ysqDone = false,
) => buildOrigins({ ysqSchemaIds, manualSchemaIds, ysqDone });

describe('buildOrigins', () => {
  it('сначала схемы теста, потом ручные', () => {
    expect(view([B], [A]).items.map((i) => i.schemaId)).toEqual([B, A]);
  });

  it('схема и в тесте, и вручную — одна строка, помечена тестом', () => {
    const items = view([A, B], [B, C]).items;
    expect(items.map((i) => i.schemaId)).toEqual([A, B, C]);
    expect(items.find((i) => i.schemaId === B)!.fromTest).toBe(true);
  });

  it('неизвестный id пропущен', () => {
    expect(view(['no_such_schema'], [A]).items.map((i) => i.schemaId)).toEqual([
      A,
    ]);
  });

  it('схем нет и теста не было — вход в тест', () => {
    expect(view([], []).empty).toBe('test');
  });

  it('схем нет, тест пройден — отметить вручную', () => {
    expect(view([], [], true).empty).toBe('pick');
  });

  it('схемы есть — пустой строки нет', () => {
    expect(view([A], []).empty).toBeNull();
  });
});

describe('originSub', () => {
  it('говорит, откуда схема на карте', () => {
    expect(originSub({ schemaId: A, name: 'x', fromTest: true })).toBe(
      'По тесту на схемы',
    );
    expect(originSub({ schemaId: A, name: 'x', fromTest: false })).toBe(
      'Отмечена в «Моих паттернах»',
    );
  });
});
