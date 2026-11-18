// Строки общего поиска «Настройки» и «Статьи»: поиск по названию и содержанию, лимит группы,
// условия показа по роли, «Недавнее» и шаг «Кому дать задание?».
import { describe, it, expect, vi } from 'vitest';
import type { ArticleSummary } from '../../api';
import { COMMON_GROUP_SHOWN, allCommonRows } from './commonRows';
import { buildPaletteRows, GROUP, type PaletteInput } from './paletteRows';

const tr = (ty: string) => ty;
const article = (id: number, title: string, description = ''): ArticleSummary =>
  ({ id, slug: `a-${id}`, title, description, date: '2026-11-01', readMin: 5 });
const ARTICLES = [article(1, 'Что такое схема', 'Откуда берутся повторяющиеся сценарии'), article(2, 'Здоровый Взрослый', 'Как он звучит')];
const run = () => ({ section: vi.fn(), path: vi.fn(), setting: vi.fn(), logout: vi.fn(), quick: vi.fn(), toggleMode: vi.fn() });
const input = (over: object = {}) => ({
  query: '', tr, therapist: false, therapistMode: false, screenShare: false, clients: [], guide: null,
  own: { tasks: [], plans: [] }, articles: ARTICLES, recent: [], assign: null, run: run(), ...over,
}) as unknown as PaletteInput;
const CABINET = { therapist: true, therapistMode: true };
const inGroup = (group: string, over: object) => buildPaletteRows(input(over)).filter((r) => r.group === group);

describe('настройки', () => {
  it('раздел находится по названию: ключ без текста, действие — лист на этом разделе', () => {
    const handlers = run();
    const [row] = inGroup(GROUP.settings, { query: 'обращение', run: handlers });
    expect(row).toMatchObject({ key: 'setting:s-address', kind: 'setting', label: 'Обращение', sub: 'На «ты» или на «вы»' });
    row.action();
    expect(handlers.setting).toHaveBeenCalledWith('s-address');
  });

  it('раздел находится по тому, что внутри него, — у клиента и в кабинете терапевта', () => {
    for (const over of [{}, CABINET]) {
      expect(inGroup(GROUP.settings, { query: 'тихие часы', ...over }).map((r) => r.key)).toEqual(['setting:s-notifications']);
      expect(inGroup(GROUP.settings, { query: 'удалить аккаунт', ...over })[0].key).toBe('setting:s-data');
    }
  });

  it('«настройки» — первым весь лист, в группе не больше лимита', () => {
    const handlers = run();
    const rows = inGroup(GROUP.settings, { query: 'настройки', run: handlers });
    expect(rows).toHaveLength(COMMON_GROUP_SHOWN);
    expect(rows[0]).toMatchObject({ key: 'setting:main', label: 'Настройки' });
    rows[0].action();
    expect(handlers.setting).toHaveBeenCalledWith(null);
  });

  it('аккаунт ведёт на свою страницу, «Выйти» — выход', () => {
    const handlers = run();
    inGroup(GROUP.settings, { query: 'способы входа', run: handlers })[0].action();
    expect(handlers.path).toHaveBeenCalledWith('/account');
    const [exit] = inGroup(GROUP.settings, { query: 'выйти', run: handlers });
    expect(exit.key).toBe('setting:logout');
    exit.action();
    expect(handlers.logout).toHaveBeenCalled();
  });

  it('строки ведут только к разделам, которые есть в листе этой роли', () => {
    const keys = (over: object) => allCommonRows(input(over)).map((r) => r.key);
    expect(keys({})).toEqual(expect.arrayContaining(['setting:s-therapist', 'setting:s-specialist']));
    expect(keys({})).not.toEqual(expect.arrayContaining(['setting:s-cabinet']));
    expect(keys({})).not.toEqual(expect.arrayContaining(['setting:s-mode']));
    expect(keys(CABINET)).toEqual(expect.arrayContaining(['setting:s-cabinet', 'setting:s-mode']));
    expect(keys(CABINET)).not.toEqual(expect.arrayContaining(['setting:s-therapist']));
    expect(keys(CABINET)).not.toEqual(expect.arrayContaining(['setting:s-specialist']));
  });
});

describe('статьи', () => {
  it('находится по названию и по описанию; действие — страница статьи', () => {
    const handlers = run();
    const [row] = inGroup(GROUP.articles, { query: 'взрослый', run: handlers });
    expect(row).toMatchObject({ key: 'article:a-2', kind: 'article', label: 'Здоровый Взрослый', sub: 'Как он звучит' });
    row.action();
    expect(handlers.path).toHaveBeenCalledWith('/articles/a-2');
    expect(inGroup(GROUP.articles, { query: 'сценарии', ...CABINET }).map((r) => r.key)).toEqual(['article:a-1']);
  });

  it('в группе не больше лимита; статей нет — группы нет', () => {
    const many = Array.from({ length: 9 }, (_, i) => article(i + 10, `Схема номер ${i}`));
    expect(inGroup(GROUP.articles, { query: 'схема номер', articles: many })).toHaveLength(COMMON_GROUP_SHOWN);
    expect(inGroup(GROUP.articles, { query: 'схема', articles: [] })).toEqual([]);
  });
});

describe('обзор, «Недавнее» и второй шаг', () => {
  it('без запроса групп нет, но «Недавнее» находит раздел настроек и статью по ключу', () => {
    for (const over of [{}, CABINET]) {
      const rows = buildPaletteRows(input({ ...over, recent: ['setting:s-address', 'article:a-1'] }));
      expect(rows.filter((r) => r.group === GROUP.recent).map((r) => r.label)).toEqual(['Обращение', 'Что такое схема']);
      expect(rows.some((r) => r.group === GROUP.settings || r.group === GROUP.articles)).toBe(false);
    }
  });

  it('на шаге «Кому дать задание?» настроек и статей нет', () => {
    const rows = buildPaletteRows(input({ ...CABINET, query: 'настройки', assign: { catalogId: null } }));
    expect(rows.filter((r) => r.kind === 'setting' || r.kind === 'article')).toEqual([]);
  });

  it('ключи — тип и id, без названий', () => {
    for (const row of allCommonRows(input(CABINET))) expect(row.key).toMatch(/^(setting|article):[\w-]+$/);
  });
});

describe('articleLead', () => {
  it('берёт первое предложение описания, без точки — описание целиком, пустое — ничего', async () => {
    const { articleLead } = await import('./articleRows');
    expect(articleLead('Первое предложение. Второе, длинное.')).toBe('Первое предложение.');
    expect(articleLead('Без точки')).toBe('Без точки');
    expect(articleLead('')).toBeUndefined();
  });
});
