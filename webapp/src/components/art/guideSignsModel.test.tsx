// @vitest-environment jsdom
// Знаки листов подсказок (docs/design/PAPER_2026-11.md): режим берёт знак своей группы
// (каждая из шести групп — свой), техника — свой знак (общих нет), схема — номер домена
// для DomainArt, раздел «Для терапевта» — свой знак. Каждый знак рисуется SVG без растра и
// литеральных цветов: только палитра бумаги. Сверка с данными: группы — MODE_GROUPS, техники и
// разделы «Для терапевта» — библиотека подсказок.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ALL_MODES, MODE_GROUPS } from '../../schemaTherapyData';
import { buildModeGuides, buildTechniqueGuides, practiceNotes } from '../../../../shared/src/schemaTherapy/guide';
import {
  GUIDE_SIGNS, MODE_GROUP_SIGN, modeGroupSign, modeSign, PRACTICE_NOTE_SIGN, practiceNoteSign, schemaDomain,
  TECHNIQUE_SIGN,
} from './guideSignsModel';
import { GuideSignArt } from './GuideSigns';

const tr = (ty: string) => ty;

/** Десять разделов «Для терапевта» (#1013). */
const NOTE_IDS = [
  'impasses', 'chatting', 'method_errors', 'therapist_schemas', 'group_therapy',
  'deliberate_practice', 'frame_additions', 'angry_client', 'suicidal_thoughts', 'romance_and_partner',
];

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

  it('«Сердитый Ребёнок» — свой знак Flare (решение 6), заголовок его группы — знак группы', () => {
    expect(ALL_MODES.some((m) => m.id === 'angry_child')).toBe(true);
    expect(modeSign('angry_child')).toBe('flare');
    expect(modeGroupSign('child')).toBe('child_care');
    expect(modeSign('constructor')).toBe('cluster');
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

  it('у каждого раздела «Для терапевта» свой знак, общих между разделами нет', () => {
    const signs = NOTE_IDS.map((id) => practiceNoteSign(id));
    for (const [i, sign] of signs.entries()) expect(sign, NOTE_IDS[i]).not.toBeNull();
    expect(new Set(signs).size).toBe(NOTE_IDS.length);
    expect(Object.keys(PRACTICE_NOTE_SIGN).sort()).toEqual([...NOTE_IDS].sort());
  });

  it('разделы справочника — ровно разделы со знаком; неизвестный раздел — без знака', () => {
    expect(practiceNotes(tr).map((n) => n.id).sort()).toEqual(Object.keys(PRACTICE_NOTE_SIGN).sort());
    expect(practiceNoteSign('нет_такого')).toBeNull();
    expect(practiceNoteSign('toString')).toBeNull();
  });

  it('«Для терапевта»: готовый мотив там, где он не врёт; знак техники — только с тем же смыслом', () => {
    expect(practiceNoteSign('impasses')).toBe('ribbon');
    expect(practiceNoteSign('therapist_schemas')).toBe('layers');
    expect(practiceNoteSign('group_therapy')).toBe('cluster');
    expect(practiceNoteSign('chatting')).not.toBe(TECHNIQUE_SIGN.chairwork);
    const shared = Object.values(PRACTICE_NOTE_SIGN).filter((s) => Object.values(TECHNIQUE_SIGN).includes(s));
    expect(shared.sort()).toEqual(['heart', 'heart_frame']);
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
