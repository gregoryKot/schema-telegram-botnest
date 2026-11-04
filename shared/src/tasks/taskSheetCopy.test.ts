// Лист «Новое задание» говорит языком того, кто ставит (QA мобильной версии 2026-11, М8):
// клиент ставил себе цель, а читал «Назначить задание» и «Назначаю…».
import { describe, it, expect } from 'vitest';
import { taskSheetCopy } from './taskSheetCopy';

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;

describe('taskSheetCopy', () => {
  it('своя цель клиента (clientId нет) — без «назначить» и «задания»', () => {
    const c = taskSheetCopy(undefined, undefined, ty);
    expect(c).toMatchObject({ title: 'Новая цель', what: 'цель', submit: 'Поставить цель', saving: 'Сохраняю…' });
    expect(Object.values(c).join(' ')).not.toMatch(/[Нн]азнач|[Зз]адани/);
  });

  it('терапевт назначает клиенту — прежние слова и имя в надзаголовке', () => {
    const c = taskSheetCopy(42, 'Ольга', ty);
    expect(c).toMatchObject({ title: 'Задание · Ольга', what: 'задание', submit: 'Назначить задание', saving: 'Назначаю…' });
    expect(taskSheetCopy(-5, null, ty).title).toBe('Новое задание');
  });

  it('ошибка пустого текста — в обеих формах обращения', () => {
    expect(taskSheetCopy(undefined, undefined, ty).emptyText).toBe('Опиши цель');
    expect(taskSheetCopy(undefined, undefined, vy).emptyText).toBe('Опишите цель');
    expect(taskSheetCopy(42, 'Ольга', vy).emptyText).toBe('Введите описание задания');
  });
});
