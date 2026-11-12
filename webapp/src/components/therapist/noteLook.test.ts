import { describe, expect, it } from 'vitest';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { kindLook } from '../../sections/diary/feedLook';
import { noteLook } from './noteLook';

// docs/open/frontend-ux.md (закрыто b31): NoteCard терапевта стоял на старом DIARY_HUE.gratitude = 145 (мох).
describe('noteLook', () => {
  it('знак и бумага по типу — как в ленте «Записей» клиента (ENTITY_LOOK)', () => {
    expect(noteLook('schema')).toEqual({ hue: 28, sign: 'layers' });
    expect(noteLook('mode')).toEqual({ hue: 240, sign: 'cluster' });
    expect(noteLook('gratitude')).toEqual({ hue: ENTITY_LOOK.gratitude.hue, sign: 'pebbles', filled: true });
    expect(noteLook('thought')).toEqual({ hue: ENTITY_LOOK.diary.hue, sign: 'pebbles' });
    for (const k of ['schema', 'mode', 'gratitude', 'thought'] as const) expect(noteLook(k).hue).toBe(kindLook(k).hue);
  });
  it('благодарность — бирюза 195, не мох 145; неизвестный тип — быстрая запись', () => {
    expect(noteLook('gratitude').hue).toBe(195);
    expect(noteLook('что-то новое')).toEqual(noteLook('thought'));
  });
});
