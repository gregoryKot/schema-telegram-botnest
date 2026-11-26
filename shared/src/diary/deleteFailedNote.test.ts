// Текст сбоя удаления (DeleteBtn → PaperAlert): заголовок без обращения, вторая фраза — в обеих формах.
import { describe, it, expect } from 'vitest';
import { deleteFailedNote } from './deleteFailedNote';

describe('deleteFailedNote', () => {
  it('в обеих формах обращения; заголовок без обращения', () => {
    const tr = (ty: string, vy: string) => `${ty}|${vy}`;
    const { title, text } = deleteFailedNote(tr);
    const [ty, vy] = text.split('|');
    expect(title).toBe('Не удалось удалить — запись на месте.');
    expect(ty).toBe('Проверь связь и попробуй ещё раз.');
    expect(vy).toBe('Проверьте связь и попробуйте ещё раз.');
  });
});
