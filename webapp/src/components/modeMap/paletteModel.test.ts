import { describe, it, expect } from 'vitest';
import { ALL_MODES, ALL_SCHEMAS, MODE_GROUPS } from '../../schemaTherapyData';
import { TYPE_COLORS } from '../modeMapData';
import {
  CATALOG_DOMAINS, CATALOG_MODE_GROUPS, CATALOG_TOTAL, FIGURES, GROUP_LABEL,
  clientModeItem, clientSchemaItem, customItem, searchPalette,
} from './paletteModel';

const mode = { id: 5, therapistId: 1, name: 'Ворчун', emoji: '🌀', nodeType: 'healthy', createdAt: '2026-01-01' };

describe('paletteModel — данные палитры холста', () => {
  it('у каждой группы режимов короткая подпись без «Копинг:», полное имя — в подсказке', () => {
    expect(Object.keys(GROUP_LABEL).sort()).toEqual(MODE_GROUPS.map(g => g.id).sort());
    for (const g of CATALOG_MODE_GROUPS) {
      expect(g.title, g.id).not.toMatch(/Копинг|режимы/);
      expect(g.hint, g.id).toBe(MODE_GROUPS.find(m => m.id === g.id)!.group);
    }
    expect(CATALOG_MODE_GROUPS.map(g => g.title)).toEqual(['Детские', 'Критикующие', 'Гиперкомпенсация', 'Избегание', 'Капитуляция', 'Здоровые']);
  });

  it('в каталоге все режимы и все схемы; счётчик строки — их сумма', () => {
    expect(CATALOG_MODE_GROUPS.flatMap(g => g.items)).toHaveLength(ALL_MODES.length);
    expect(CATALOG_DOMAINS.flatMap(d => d.items)).toHaveLength(ALL_SCHEMAS.length);
    expect(CATALOG_TOTAL).toBe(ALL_MODES.length + ALL_SCHEMAS.length);
    expect(CATALOG_DOMAINS.map(d => d.domain)).toEqual([1, 2, 3, 4, 5]);
  });

  it('режим — знак своей группы (или свой), схема — знак домена, как в «Справочнике»', () => {
    const child = CATALOG_MODE_GROUPS[0].items[0];
    expect(child).toMatchObject({ mark: 'mode', sign: 'child_care', color: TYPE_COLORS.child });
    expect(CATALOG_MODE_GROUPS[0].items.find(i => i.id === 'angry_child')!.sign).toBe('flare'); // свой знак режима (решение 6)
    expect(CATALOG_MODE_GROUPS.map(g => g.items[0].sign)).toEqual(['child_care', 'looming', 'shield', 'shelter', 'yield', 'together']);
    expect(CATALOG_DOMAINS.map(d => [...new Set(d.items.map(i => i.domain))])).toEqual([[1], [2], [3], [4], [5]]);
    const schema = CATALOG_DOMAINS[0].items[0];
    expect(schema.mark).toBe('schema');
    expect(schema.draft().data.customColor).toBe(schema.color);
  });

  it('свой режим — знак группы по типу фигуры, выбранному при создании; тип «свой» — общий знак режимов', () => {
    const item = customItem(mode);
    expect(item).toMatchObject({ name: 'Ворчун', mark: 'mode', sign: 'together', color: TYPE_COLORS.healthy });
    expect(customItem({ ...mode, nodeType: 'custom' }).sign).toBe('cluster');
    expect(customItem({ ...mode, nodeType: 'coping' }).sign).toBe('shield');
    expect(item.draft()).toMatchObject({ type: 'healthy', data: { label: 'Ворчун' } });
    expect(customItem({ ...mode, nodeType: 'coping' }).draft().data.copingSubtype).toBe('over');
  });

  it('режим и схема клиента: известный id — строка, неизвестный — null', () => {
    expect(clientModeItem('punitive_critic')).toMatchObject({ name: 'Карающий Критик', mark: 'mode', sign: 'looming', color: TYPE_COLORS.critic });
    expect(clientModeItem('нет_такого')).toBeNull();
    expect(clientSchemaItem('abandonment')).toMatchObject({ name: 'Покинутость / Нестабильность', mark: 'schema', domain: 1 });
    expect(clientSchemaItem('нет_такой')).toBeNull();
  });

  it('фигуры: круг потребностей кладётся колесом, потребность — без чужих полей', () => {
    const byType = Object.fromEntries(FIGURES.map(f => [f.type, f]));
    expect(FIGURES.map(f => f.type)).toEqual(['trigger', 'behavior', 'schema', 'origin', 'need', 'needs']);
    expect(byType.needs.draft().data).toEqual({ label: 'Базовые эмоциональные потребности', wheel: {} });
    expect(byType.need.draft().data).toEqual({ label: 'Потребность' });
    expect(byType.trigger.draft()).toMatchObject({ type: 'trigger', data: { label: 'Триггер' } });
  });

  it('поиск — плоский список по всему: режимы, свои, схемы, фигуры', () => {
    expect(searchPalette('крит', []).map(i => i.name)).toEqual(expect.arrayContaining(['Карающий Критик', 'Требовательный Критик']));
    const found = searchPalette('покину', [mode]);
    expect(found.map(i => [i.name, i.mark])).toEqual([['Покинутый Ребёнок', 'mode'], ['Покинутость / Нестабильность', 'schema']]);
    expect(searchPalette('ворч', [mode]).map(i => i.name)).toEqual(['Ворчун']);
    expect(searchPalette('ситуац', []).map(i => [i.name, i.mark])).toContainEqual(['Триггер', 'trigger']);
    expect(searchPalette('зюзю', [])).toEqual([]);
  });
});
