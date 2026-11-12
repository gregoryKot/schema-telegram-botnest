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
