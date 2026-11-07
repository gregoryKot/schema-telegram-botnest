// @vitest-environment jsdom
// Знаки листов подсказок (docs/design/PAPER_2026-11.md): режим берёт знак своей группы
// (каждая из шести групп — свой), техника — свой знак (общих нет), схема — номер домена
// для DomainArt. Каждый знак рисуется SVG без растра и литеральных цветов: только палитра
// бумаги. Сверка с данными: группы — MODE_GROUPS, техники — библиотека подсказок.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ALL_MODES, MODE_GROUPS } from '../../schemaTherapyData';
import { buildModeGuides, buildTechniqueGuides } from '../../../../shared/src/schemaTherapy/guide';
import {
  GUIDE_SIGNS, MODE_GROUP_SIGN, modeGroupSign, modeSign, schemaDomain, TECHNIQUE_SIGN,
} from './guideSignsModel';
import { GuideSignArt } from './GuideSigns';

const tr = (ty: string) => ty;

describe('знаки листов подсказок', () => {
  it('у каждой группы режимов свой знак, и группы модели — ровно группы данных', () => {
    expect(Object.keys(MODE_GROUP_SIGN).sort()).toEqual(MODE_GROUPS.map((g) => g.id).sort());
    const signs = Object.values(MODE_GROUP_SIGN);
    expect(new Set(signs).size).toBe(signs.length);
    expect(signs).not.toContain('cluster');
  });

  it('режим берёт знак своей группы; режим без группы — общий знак режимов', () => {
    expect(modeSign('vulnerable_child')).toBe('child_care');
    expect(modeSign('compliant_surrenderer')).toBe('yield');
    expect(modeSign('detached_protector')).toBe('shelter');
    expect(modeSign('overcontroller')).toBe('shield');
    expect(modeSign('punitive_critic')).toBe('looming');
    expect(modeSign('healthy_adult')).toBe('together');
    expect(modeSign('свой_режим')).toBe('cluster');
    for (const m of ALL_MODES) expect(modeSign(m.id), m.id).not.toBe('cluster');
  });

  it('знак группы по id (заголовок группы в палитре холста); неизвестная группа — общий знак режимов', () => {
    for (const g of MODE_GROUPS) expect(modeGroupSign(g.id), g.id).toBe(MODE_GROUP_SIGN[g.id as keyof typeof MODE_GROUP_SIGN]);
    expect(modeGroupSign('critic')).toBe('looming');
    expect(modeGroupSign('нет_такой')).toBe('cluster');
    expect(modeGroupSign(undefined)).toBe('cluster');
  });

  it('у каждого листа режима в подсказках есть знак группы', () => {
    for (const g of buildModeGuides(tr)) expect(modeSign(g.modeId), g.modeId).not.toBe('cluster');
  });

  it('у каждой техники библиотеки свой знак, общих нет', () => {
    const ids = buildTechniqueGuides(tr).map((t) => t.id);
    expect(ids.sort()).toEqual(Object.keys(TECHNIQUE_SIGN).sort());
    const signs = ids.map((id) => TECHNIQUE_SIGN[id]);
    expect(new Set(signs).size).toBe(signs.length);
  });

  it('готовый мотив там, где он точно подходит', () => {
    expect(TECHNIQUE_SIGN.chairwork).toBe('talk');
    expect(TECHNIQUE_SIGN.letters).toBe('sheets');
    expect(TECHNIQUE_SIGN.mindfulness).toBe('breath');
    expect(TECHNIQUE_SIGN.self_compassion).toBe('heart');
    expect(TECHNIQUE_SIGN.pattern_breaking).toBe('pattern_steps');
    expect(TECHNIQUE_SIGN.cognitive_work).toBe('pebbles');
  });

  it('схема — номер своего домена; неизвестная — 0', () => {
    expect(schemaDomain('abandonment')).toBe(1);
    expect(schemaDomain('нет_такой')).toBe(0);
  });

  it('каждый знак — декоративный SVG из палитры бумаги', () => {
    for (const sign of GUIDE_SIGNS) {
      const { container, unmount } = render(<GuideSignArt sign={sign} size="hero" />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('aria-hidden'), sign).toBe('true');
      expect(svg.getAttribute('class'), sign).toContain('pp-art--hero');
      expect(svg.children.length, sign).toBeGreaterThan(0);
      expect(svg.innerHTML, sign).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(|<image|filter|blur/i);
      unmount();
    }
  });
});
