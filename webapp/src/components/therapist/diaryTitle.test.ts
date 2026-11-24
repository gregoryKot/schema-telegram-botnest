import { describe, it, expect } from 'vitest';
import { diaryTitle } from './diaryTitle';

describe('diaryTitle', () => {
  it('ярлыки одинаковы для превью и заметок', () => {
    expect(diaryTitle({ type: 'schema' }).typeLabel).toBe('Дневник схем');
    expect(diaryTitle({ type: 'mode' }).typeLabel).toBe('Дневник режимов');
    expect(diaryTitle({ type: 'schema', schemaIds: ['abandonment', 'mistrust'] }).title).toMatch(/ \+1$/);
    expect(diaryTitle({ type: 'schema', schemaIds: ['nope'] }).title).toBe('nope');
    expect(diaryTitle({ type: 'mode', modeId: 'vulnerable_child' }).title.length).toBeGreaterThan(0);
    expect(diaryTitle({ type: 'gratitude' })).toEqual({ title: 'Благодарность', typeLabel: 'Дневник благодарности' });
  });
});
