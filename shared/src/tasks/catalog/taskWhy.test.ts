import { describe, it, expect } from 'vitest';
import * as guide from '../../schemaTherapy/guide';
import { buildTaskCatalog } from './taskCatalog';
import {
  buildTaskWhy,
  catalogIdAfterEdit,
  catalogTaskParts,
  taskWhy,
} from './taskWhy';

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;

describe('«зачем» у заданий справочника', () => {
  it('сверка: у каждой записи каталога есть «зачем», лишних текстов нет', () => {
    const ids = buildTaskCatalog(guide, ty).map((t) => t.id);
    expect(Object.keys(buildTaskWhy(ty)).sort()).toEqual([...ids].sort());
    for (const task of buildTaskCatalog(guide, vy))
      expect(task.why.length).toBeGreaterThan(20);
  });

  it('«вы»-текст без «ты»-форм, «ты»-текст без «вы»', () => {
    for (const text of Object.values(buildTaskWhy(vy)))
      expect(text).not.toMatch(
        /(^|[^а-яё])(ты|тебе|тебя|тво[йяеёи])(?![а-яё])/i,
      );
    for (const text of Object.values(buildTaskWhy(ty)))
      expect(text).not.toMatch(/(^|[^а-яё])(вы|вам|вас|ваш[аеи]?)(?![а-яё])/i);
  });

  it('taskWhy: текст по id; нет id, незнакомый id или имя из прототипа — null', () => {
    expect(taskWhy('тайм-аут', ty)).toContain('Пауза');
    expect(taskWhy('прямая-просьба', vy)).toContain('вам нужно');
    expect(taskWhy(null, ty)).toBeNull();
    expect(taskWhy(undefined, ty)).toBeNull();
    expect(taskWhy('нет-такого', ty)).toBeNull();
    expect(taskWhy('constructor', ty)).toBeNull();
  });

  it('catalogTaskParts: первая строка — название, остальное — «что делать»', () => {
    expect(catalogTaskParts('Тайм-аут\nвыйти\nвернуться')).toEqual({
      title: 'Тайм-аут',
      what: 'выйти\nвернуться',
    });
    expect(catalogTaskParts('одна строка')).toEqual({
      title: 'одна строка',
      what: '',
    });
  });

  it('catalogIdAfterEdit: дописанный текст остаётся записью каталога, стёртый целиком — нет', () => {
    expect(catalogIdAfterEdit('тайм-аут', 'Тайм-аут, до пятницы')).toBe(
      'тайм-аут',
    );
    expect(catalogIdAfterEdit('тайм-аут', '  ')).toBeNull();
    expect(catalogIdAfterEdit(null, 'своё')).toBeNull();
  });
});
