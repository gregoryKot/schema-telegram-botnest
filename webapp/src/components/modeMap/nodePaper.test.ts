import { describe, it, expect } from 'vitest';
import { getSchemaById } from '../../schemaTherapyData';
import { needColor } from '../../../../shared/src/needs/needColors';
import { MODE_GROUP_HUE } from '../../lib/tone';
import { TYPE_COLORS } from '../modeMapData';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NODE_PAPER_LC } from '../../../../shared/src/modeMap/nodePaperTone';
import { shapePaint } from '../../../../shared/src/therapy/conceptGraph/diagram/diagramPaper';
import { TYPE_HUE, nodeHue, nodePaper } from './nodePaper';
import { isPlainPaper } from './plainPaper';
import { toFlowNodes } from '../modeMapFlow';
import { FIGURES } from './paletteModel';
import { COLOR_PRESETS } from './editorStyles';

describe('nodeHue — оттенок бумаги фигуры', () => {
  it('у каждого типа узла есть оттенок; режимы берут тон своей группы', () => {
    expect(new Set(Object.keys(TYPE_HUE))).toEqual(new Set(Object.keys(TYPE_COLORS)));
    expect(nodeHue('child', {})).toBe(MODE_GROUP_HUE.child);
    expect(nodeHue('critic', {})).toBe(MODE_GROUP_HUE.critic);
    expect(nodeHue('coping', {})).toBe(MODE_GROUP_HUE.coping_avoidance);
    expect(nodeHue('healthy', {})).toBe(MODE_GROUP_HUE.healthy);
    expect(nodeHue('no_such_type', {})).toBe(TYPE_HUE.custom);
  });

  it('схема — оттенок домена, пока цвет фигуры родной (цвет домена или пусто)', () => {
    const s = getSchemaById('entitlement')!; // домен «Нарушение границ» — 135
    expect(nodeHue('schema', { schemaId: s.id, customColor: s.domainColor })).toBe(135);
    expect(nodeHue('schema', { schemaId: s.id })).toBe(135);
    expect(nodeHue('schema', {})).toBe(TYPE_HUE.schema);
  });

  it('старая одиночная schemaId у режима оттенок режима не меняет', () => {
    expect(nodeHue('child', { schemaId: 'entitlement' })).toBe(TYPE_HUE.child);
  });

  it('потребность — её оттенок, пока цвет родной', () => {
    expect(nodeHue('need', { needId: 'play', customColor: needColor('play') })).toBe(310);
    expect(nodeHue('need', { needId: 'play' })).toBe(310);
  });

  it('цвет из набора редактора — лист той же бумаги; цвет вне палитры — null (бумага из него самого)', () => {
    expect(nodeHue('child', { customColor: 'var(--c-slate)' })).toBe(240);
    expect(nodeHue('schema', { schemaId: 'entitlement', customColor: 'var(--c-plum)' })).toBe(310);
    expect(nodeHue('child', { customColor: '#7aa3d4' })).toBeNull();
  });
});

describe('nodePaper — класс и переменные корня фигуры', () => {
  const vars = (style: object) => style as Record<string, unknown>;

  it('оттенок уходит в --h, толщина контура — в --n-sw', () => {
    const p = nodePaper('critic', { label: 'К' }, false, 'mm2-n--svg');
    expect(p.className).toBe('mm2-n mm2-n--svg');
    expect(vars(p.style)['--h']).toBe(310);
    expect(vars(p.style)['--n-sw']).toBe('1.5px');
    expect(vars(nodePaper('critic', { label: 'К', strokeWidth: 'bold' }).style)['--n-sw']).toBe('3px');
    expect(vars(nodePaper('critic', { label: 'К', strokeWidth: 'thin' }).style)['--n-sw']).toBe('1px');
  });

  it('заливка, сплошная заливка и выделение — классами; сплошная сильнее обычной', () => {
    expect(nodePaper('child', { label: 'Р', filled: true }).className).toBe('mm2-n is-filled');
    expect(nodePaper('child', { label: 'Р', filled: true, fillFull: true }).className).toBe('mm2-n is-full');
    expect(nodePaper('child', { label: 'Р' }, true).className).toBe('mm2-n is-selected');
  });

  it('цвет вне палитры: класс is-own, бумага подмешана из него самого, без --h', () => {
    const p = nodePaper('child', { label: 'Р', customColor: '#7aa3d4' });
    expect(p.className).toBe('mm2-n is-own');
    expect(p.ink.fill).toBe('color-mix(in oklch, #7aa3d4 16%, white)');
    expect(vars(p.style)['--h']).toBeUndefined();
  });

  it('цвета — готовыми значениями без var(): их же получает SVG-контур, экспорт картинкой переменных не знает', () => {
    const p = nodePaper('critic', { label: 'К' });
    expect(p.ink).toEqual({ fill: 'oklch(0.915 0.03 310)', line: 'oklch(0.72 0.07 310)', shade: 'oklch(0.85 0.045 310)' });
    expect(vars(p.style)['--n-fill']).toBe(p.ink.fill);
    expect(vars(p.style)['--n-line']).toBe(p.ink.line);
    expect(vars(p.style)['--n-shade']).toBe(p.ink.shade);
    for (const d of [{ label: 'К', filled: true }, { label: 'К', fillFull: true }, { label: 'К', customColor: '#7aa3d4' }]) {
      expect(Object.values(nodePaper('critic', d).ink).join(' ')).not.toContain('var(');
    }
    expect(nodePaper('critic', { label: 'К', fillFull: true }).ink.fill).toBe('oklch(0.5 0.085 310)');
  });

  it('выделенная фигура — контур акцентом', () => {
    expect(nodePaper('critic', { label: 'К' }, true).ink.line).toBe('var(--accent)');
  });
});

// Правило №4: узел холста карт и фигура схемы случая — одна бумага (shared/src/modeMap/nodePaperTone.ts).
// До сведения контур расходился (0.72 0.07 на холсте, 0.7 0.075 на схеме случая).
describe('бумага узла одна на холст карт и схему случая', () => {
  it.each(Object.entries(MODE_GROUP_HUE))('группа %s: лицо и контур совпадают с фигурой схемы случая', (_g, hue) => {
    const { ink } = nodePaper('custom', { label: 'Р' });
    const canvas = { fill: ink.fill.replace(/[\d.]+\)$/, `${hue})`), stroke: ink.line.replace(/[\d.]+\)$/, `${hue})`) };
    expect(shapePaint(hue)).toEqual(canvas);
  });

  it('«Заливка» держит тот же контур; подпись дорожки в css — тот же тон', () => {
    expect(nodePaper('critic', { label: 'К', filled: true }).ink.line).toBe(`oklch(${NODE_PAPER_LC.line} 310)`);
    const css = readFileSync(join(__dirname, '../../styles/modemap-paper.css'), 'utf8');
    expect(css).toContain(`.mm2-lane-input {`);
    expect(css.match(/\.mm2-lane-input \{[^}]*border-color: oklch\(([\d. ]+) var\(--h\)\)/)?.[1]).toBe(NODE_PAPER_LC.line);
  });
});

// Ревью вкуса r1 (b34): триггер (135) и Здоровый Взрослый (145) читались одной зелёной семьёй, опыт
// детства и Отстранённый Защитник — оба небесные; «поведение» носило оттенок, будто сущность.
describe('оттенки фигур не сливаются (ревью r1)', () => {
  it('триггер — солома 70, опыт детства — персик 45, Здоровый Взрослый — мох 145, копинг — небо 240', () => {
    expect(nodeHue('trigger', {})).toBe(70);
    expect(nodeHue('origin', {})).toBe(45);
    expect(nodeHue('healthy', {})).toBe(145);
    expect(nodeHue('coping', {})).toBe(240);
    // ни одна пара из четырёх не ближе 40° — на бумаге L 0.915 C 0.03 соседние 10° неразличимы
    const hues = ['trigger', 'origin', 'healthy', 'coping', 'critic'].map((t) => TYPE_HUE[t]).sort((a, b) => a - b);
    hues.slice(1).forEach((h, i) => expect(h - hues[i]).toBeGreaterThanOrEqual(25));
  });

  it('поведение — нейтральная бумага страницы с серым контуром (хрома ≤ 0.012), готовыми значениями без var()', () => {
    const p = nodePaper('behavior', { label: 'П' });
    expect(isPlainPaper('behavior', {})).toBe(true);
    for (const c of Object.values(p.ink)) {
      expect(c).not.toContain('var(');
      expect(Number(c.match(/^oklch\([\d.]+ ([\d.]+) /)?.[1])).toBeLessThanOrEqual(0.012);
    }
    expect(Number(p.ink.fill.match(/^oklch\(([\d.]+) /)?.[1])).toBeGreaterThan(0.95);
    expect(p.className).toBe('mm2-n');
    // «Заливка» и «Полная» остаются различимыми ступенями той же серой бумаги
    const fills = [{}, { filled: true }, { fillFull: true }].map((d) => nodePaper('behavior', { label: 'П', ...d }).ink.fill);
    expect(new Set(fills).size).toBe(3);
  });

  it('цвет поведению выбран вручную — лист этого цвета, а не нейтральный', () => {
    expect(isPlainPaper('behavior', { customColor: 'var(--c-plum)' })).toBe(false);
    expect(nodePaper('behavior', { label: 'П', customColor: 'var(--c-plum)' }).ink.fill).toBe('oklch(0.915 0.03 310)');
    expect(isPlainPaper('trigger', {})).toBe(false);
  });
});

// Правило №4 (смена TYPE_COLORS / TYPE_HUE): цвет типа в узел не пишется — фигура без customColor
// берёт бумагу по типу при каждом рисовании. Поэтому карта, сохранённая до смены оттенков, рисуется
// так же, как узел, созданный сегодня; выбранный вручную цвет при этом не теряется.
describe('старая сохранённая карта рисуется как новая', () => {
  const saved = (type: string, data: Record<string, unknown> = {}) =>
    toFlowNodes([{ id: 'old', type, position: { x: 0, y: 0 }, data: { label: 'Старый', ...data } } as never])[0];

  it.each(['trigger', 'behavior', 'origin', 'need', 'needs', 'schema'] as const)('%s: узел из сохранённой карты (без цвета) — та же бумага, что у нового узла из палитры', (type) => {
    const fresh = FIGURES.find((f) => f.type === type)!.draft();
    expect(fresh.data.customColor).toBeUndefined(); // новая фигура цвет типа не хранит — нормализовать при чтении нечего
    const old = saved(type);
    expect(nodePaper(old.type!, old.data as never).ink).toEqual(nodePaper(fresh.type, fresh.data).ink);
  });

  it('цвет, выбранный вручную в старой карте, сохраняется: лист этого цвета, кружок «Цвет» — он же', () => {
    for (const c of COLOR_PRESETS) {
      const old = saved('trigger', { customColor: c });
      expect(old.data.customColor).toBe(c);
      expect(nodeHue('trigger', old.data as never)).not.toBeNull();
    }
    expect(nodePaper('trigger', saved('trigger', { customColor: 'var(--c-moss)' }).data as never).ink.fill).toBe('oklch(0.915 0.03 145)');
    expect(nodePaper('origin', saved('origin', { customColor: 'var(--c-slate)' }).data as never).ink.fill).toBe('oklch(0.915 0.03 240)');
  });

  it('кружок «Цвет» по умолчанию: цвет типа — из набора редактора и той же семьи, что бумага; у нейтрального поведения кружок не подсвечен', () => {
    const TOKEN = { 'var(--c-amber)': 70, 'var(--c-clay)': 45 } as Record<string, number>;
    for (const type of ['trigger', 'origin']) {
      expect(COLOR_PRESETS).toContain(TYPE_COLORS[type]);
      expect(TOKEN[TYPE_COLORS[type]]).toBe(TYPE_HUE[type]);
      expect(nodeHue(type, { customColor: TYPE_COLORS[type] })).toBe(nodeHue(type, {})); // тап по подсвеченному кружку бумагу не меняет
    }
    expect(COLOR_PRESETS).not.toContain(TYPE_COLORS.behavior);
  });
});
