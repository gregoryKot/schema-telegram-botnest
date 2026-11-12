// Сверка литеральной таблицы знака задания (taskEntity.ts) с общей `taskRouteEntity` (shared/src/theme):
// таблица живёт рядом с потребителем ради порядка CSS-чанков (сведение g6), а расходиться им нельзя (правило №4).
import { describe, it, expect } from 'vitest';
import { routeEntity, taskEntity } from './taskEntity';
import { taskRouteEntity } from '../../../../shared/src/theme/entityLook';
import type { TaskRoute } from '../../../../shared/src/tasks/taskRoute';

const ROUTES: TaskRoute[] = [
  { kind: 'diary' },
  { kind: 'tracker' },
  { kind: 'childhood_wheel' },
  { kind: 'exercise', exercise: 'belief_check' },
  { kind: 'exercise', exercise: 'letter_to_self' },
  { kind: 'exercise', exercise: 'safe_place' },
  { kind: 'exercise', exercise: 'flashcard' },
  { kind: 'schema' },
  { kind: 'schema', id: 'abandonment' },
  { kind: 'mode' },
  { kind: 'ysq' },
  { kind: 'self' },
  { kind: 'none' },
];

describe('taskEntity', () => {
  it('каждый маршрут — та же сущность, что у taskRouteEntity', () => {
    for (const r of ROUTES) expect(routeEntity(r), JSON.stringify(r)).toBe(taskRouteEntity(r));
  });

  it('сверка видит расхождение: другой маршрут — другая сущность', () => {
    expect(routeEntity({ kind: 'exercise', exercise: 'letter_to_self' })).not.toBe(taskRouteEntity({ kind: 'self' }));
  });

  it('задание — по маршруту: письмо, дневник, своё', () => {
    expect(taskEntity({ type: 'letter_to_self', text: '' })).toBe('letter');
    expect(taskEntity({ type: 'diary_streak', text: '' })).toBe('diary');
    expect(taskEntity({ type: 'custom', text: 'Позвонить' })).toBe('task');
  });
});
