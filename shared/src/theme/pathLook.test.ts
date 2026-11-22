// Вид листов «Пути терапии» (pathLook.ts): у каждого листа вкладки есть знак и оттенок, стадии разведены по кругу палитры.
import { describe, it, expect } from 'vitest';
import { buildPhaseGuides } from '../schemaTherapy/guide';
import { TEMPLATE_SHEET_PREFIX } from '../schemaTherapy/guide/phases/templateSheets';
import { PATH_TEMPLATE_BUILDERS } from '../therapy/path/templates';
import { PAPER_HUE, SIGN_KEYS } from './signKeys';
import { PATH_SIGN_KEYS } from './pathSignKeys';
import {
  PHASE_LOOK,
  PHASE_LOOK_KEYS,
  pathSheetLook,
  phaseLook,
  TEMPLATE_SHEET_PREFIX_ID,
} from './pathLook';

const tr = (ty: string) => ty;
const hues = new Set<number>(Object.values(PAPER_HUE));

describe('pathSheetLook', () => {
  it('у каждого листа вкладки есть знак реестра и оттенок палитры', () => {
    const ids = buildPhaseGuides(tr).map((p) => p.id);
    expect(ids.length).toBeGreaterThan(14);
    for (const id of ids) {
      const look = pathSheetLook(id);
      expect(look.sign, id).toBeDefined();
      expect(SIGN_KEYS, id).toContain(look.sign);
      expect(hues, id).toContain(look.hue);
    }
  });

  it('шесть стадий — шесть разных оттенков и знаков, обзор — сирень; общий знак шаблона', () => {
    expect(new Set(PHASE_LOOK_KEYS.map((k) => phaseLook(k).hue)).size).toBe(6);
    expect(new Set(PHASE_LOOK_KEYS.map((k) => phaseLook(k).sign)).size).toBe(6);
    expect(pathSheetLook('overview').hue).toBe(PAPER_HUE.lilac);
    for (const key of PHASE_LOOK_KEYS)
      expect(pathSheetLook(key)).toBe(PHASE_LOOK[key]);
    const signs = PATH_TEMPLATE_BUILDERS.map(
      (b) => pathSheetLook(TEMPLATE_SHEET_PREFIX + b(tr).id).sign,
    );
    expect(new Set(signs)).toEqual(new Set(['path_template']));
  });

  it('приставка листа шаблона та же, что в справочнике; неизвестный лист — сирень без знака', () => {
    expect(TEMPLATE_SHEET_PREFIX_ID).toBe(TEMPLATE_SHEET_PREFIX);
    expect(pathSheetLook('нет')).toEqual({ hue: PAPER_HUE.lilac });
    expect(pathSheetLook(`${TEMPLATE_SHEET_PREFIX}нет`)).toEqual({
      hue: PAPER_HUE.lilac,
    });
  });

  it('все ключи знаков пути заняты листами', () => {
    const used = new Set([
      ...buildPhaseGuides(tr).map((p) => pathSheetLook(p.id).sign),
      pathSheetLook(`${TEMPLATE_SHEET_PREFIX}general`).sign,
    ]);
    expect([...PATH_SIGN_KEYS].filter((k) => !used.has(k))).toEqual([]);
  });
});
