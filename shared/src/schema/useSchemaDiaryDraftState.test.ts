// @vitest-environment jsdom
// Хук формы дневника схем — общий для webapp/miniapp SchemaEntrySheet
// (правило №3/№11: было продублировано дословно). Тестируем инициализацию
// из черновика (read-after-write: то, что передали в draft, должно
// оказаться в values/emotions/schemaIds) и переключатели чипов.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSchemaDiaryDraftState } from './useSchemaDiaryDraftState';

const haptic = () => ({ select: vi.fn() });

describe('useSchemaDiaryDraftState — инициализация', () => {
  it('без черновика — все поля пустые строки, emotions/schemaIds пустые', () => {
    const { result } = renderHook(() => useSchemaDiaryDraftState(null, haptic()));
    expect(result.current.values.trigger).toBe('');
    expect(result.current.values.healthyView).toBe('');
    expect(result.current.emotions).toEqual([]);
    expect(result.current.schemaIds).toEqual([]);
  });

  it('с черновиком — поля/эмоции/схемы подставляются из него (read-after-write)', () => {
    const draft = {
      trigger: 'Молчание в переписке',
      thoughts: '',
      bodyFeelings: '',
      actualBehavior: '',
      schemaOrigin: '',
      healthyView: 'Пауза — не уход',
      realProblems: '',
      excessiveReactions: '',
      healthyBehavior: '',
      emotions: [{ id: 'anxiety', intensity: 4 }],
      schemaIds: ['abandonment'],
    };
    const { result } = renderHook(() =>
      useSchemaDiaryDraftState(draft, haptic()),
    );
    expect(result.current.values.trigger).toBe('Молчание в переписке');
    expect(result.current.values.healthyView).toBe('Пауза — не уход');
    expect(result.current.emotions).toEqual([{ id: 'anxiety', intensity: 4 }]);
    expect(result.current.schemaIds).toEqual(['abandonment']);
  });
});

describe('useSchemaDiaryDraftState — setField', () => {
  it('меняет только указанное поле, остальные не трогает', () => {
    const { result } = renderHook(() => useSchemaDiaryDraftState(null, haptic()));
    act(() => result.current.setField('trigger', 'Новая ситуация'));
    expect(result.current.values.trigger).toBe('Новая ситуация');
    expect(result.current.values.thoughts).toBe('');
  });
});

describe('useSchemaDiaryDraftState — toggleEmotion / setIntensity', () => {
  it('toggle добавляет эмоцию с интенсивностью по умолчанию 3, повторный toggle убирает', () => {
    const h = haptic();
    const { result } = renderHook(() => useSchemaDiaryDraftState(null, h));
    act(() => result.current.toggleEmotion('sadness'));
    expect(result.current.emotions).toEqual([{ id: 'sadness', intensity: 3 }]);
    expect(h.select).toHaveBeenCalledTimes(1);

    act(() => result.current.toggleEmotion('sadness'));
    expect(result.current.emotions).toEqual([]);
  });

  it('setIntensity меняет интенсивность конкретной эмоции, не создавая дублей', () => {
    const { result } = renderHook(() => useSchemaDiaryDraftState(null, haptic()));
    act(() => result.current.toggleEmotion('anger'));
    act(() => result.current.setIntensity('anger', 5));
    expect(result.current.emotions).toEqual([{ id: 'anger', intensity: 5 }]);
  });
});

describe('useSchemaDiaryDraftState — toggleSchema', () => {
  it('toggle добавляет id схемы, повторный — убирает (мультивыбор без дублей)', () => {
    const { result } = renderHook(() => useSchemaDiaryDraftState(null, haptic()));
    act(() => result.current.toggleSchema('abandonment'));
    act(() => result.current.toggleSchema('mistrust'));
    expect(result.current.schemaIds.sort()).toEqual(['abandonment', 'mistrust']);

    act(() => result.current.toggleSchema('abandonment'));
    expect(result.current.schemaIds).toEqual(['mistrust']);
  });
});
