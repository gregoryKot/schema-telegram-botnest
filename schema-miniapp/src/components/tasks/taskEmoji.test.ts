// Тест на резолвинг иконки/текста задачи — вынесено из HelpSection.tsx и
// TodaySection.tsx (свип дублей 2026-07, отложенный хвост «виджет задач»).
// Копии успели разойтись: TASK_EMOJI.custom ('✏️' в Help vs '🎯' в Today,
// совпадал с иконкой самого виджета целей) и фолбэк resolveTaskEmoji
// ('⏳' в Help vs '🎯' в Today) — тест фиксирует выбранную (Help) версию,
// чтобы дрейф не вернулся при следующей правке.
import { describe, it, expect } from 'vitest';
import {
  TASK_EMOJI,
  resolveTaskEmoji,
  resolveTaskDisplayText,
  findLegacyTaskTarget,
} from './taskEmoji';
import { ALL_SCHEMAS, ALL_MODES } from '../../schemaTherapyData';
import { UserTask } from '../../api';

function makeTask(overrides: Partial<UserTask> = {}): UserTask {
  return {
    id: 1,
    userId: 1,
    assignedBy: null,
    type: 'custom',
    text: 'Позвонить маме',
    targetDays: null,
    needId: null,
    dueDate: null,
    done: null,
    completedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('TASK_EMOJI', () => {
  it('custom — карандаш, не совпадает с иконкой виджета «Мои цели» (🎯)', () => {
    expect(TASK_EMOJI.custom).toBe('✏️');
    expect(TASK_EMOJI.custom).not.toBe('🎯');
  });
});

describe('resolveTaskEmoji', () => {
  it('известный тип — берёт иконку из TASK_EMOJI', () => {
    expect(resolveTaskEmoji(makeTask({ type: 'diary_streak' }))).toBe('📔');
  });

  it('легаси-задача с raw id схемы в text — иконка схемы', () => {
    const schemaId = ALL_SCHEMAS[0].id;
    expect(resolveTaskEmoji(makeTask({ type: 'legacy', text: schemaId }))).toBe(
      '🧩',
    );
  });

  it('легаси-задача с raw id режима в text — иконка режима', () => {
    const modeId = ALL_MODES[0].id;
    expect(resolveTaskEmoji(makeTask({ type: 'legacy', text: modeId }))).toBe(
      '🔄',
    );
  });

  it('полностью нераспознанный тип — фолбэк ⏳ (не 🎯, чтобы не путать с целью/custom)', () => {
    expect(
      resolveTaskEmoji(makeTask({ type: 'unknown_type', text: 'мусор' })),
    ).toBe('⏳');
  });
});

describe('resolveTaskDisplayText', () => {
  it('schema_intro — полный вариант с типизированным текстом', () => {
    const schema = ALL_SCHEMAS[0];
    const task = makeTask({ type: 'schema_intro', text: schema.id });
    expect(resolveTaskDisplayText(task, 'full')).toBe(
      `Карточка схемы: ${schema.name}`,
    );
  });

  it('легаси raw schema id — full добавляет префикс, compact — только имя', () => {
    const schema = ALL_SCHEMAS[0];
    const task = makeTask({ type: 'legacy', text: schema.id });
    expect(resolveTaskDisplayText(task, 'full')).toBe(
      `Карточка схемы: ${schema.name}`,
    );
    expect(resolveTaskDisplayText(task, 'compact')).toBe(schema.name);
  });

  it('обычный custom-текст возвращается как есть в обоих вариантах', () => {
    const task = makeTask({ type: 'custom', text: 'Погулять 20 минут' });
    expect(resolveTaskDisplayText(task, 'full')).toBe('Погулять 20 минут');
    expect(resolveTaskDisplayText(task, 'compact')).toBe('Погулять 20 минут');
  });
});

describe('findLegacyTaskTarget', () => {
  it('null для текста, который не является id схемы/режима', () => {
    expect(findLegacyTaskTarget('точно не id')).toBeNull();
  });

  it('находит режим по id', () => {
    const mode = ALL_MODES[0];
    expect(findLegacyTaskTarget(mode.id)).toEqual({
      type: 'mode',
      id: mode.id,
      name: mode.name,
    });
  });
});
