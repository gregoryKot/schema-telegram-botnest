// @vitest-environment jsdom
/// <reference types="node" />
// Правило масштабирования №4 (#1484): лист справочника рисует раздел только через GuideSection (или
// GuideVoice/GuidePoints с адресом) — свой заголовок «вручную» лишает раздел «Про клиента».
// Сторож двух уровней: в *Sheet.tsx нет разметки раздела руками, и каждый раздел на живых текстах
// несёт адрес, который находит свой текст (resolveAddress).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import * as guide from '../../../../../shared/src/schemaTherapy/guide';
import { resolveModeGuide, resolveSchemaGuide } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { GuideMarkContext, type GuideMarkCtx } from './marks/GuideSectionMark';
import { ConcernGuideSheet } from './ConcernGuideSheet';
import { phaseView } from '../../../sections/guide/guideReferencePhases';
import { ModeGuideSheet } from './ModeGuideSheet';
import { NeedGuideSheet } from './NeedGuideSheet';
import { buildNeedGuides } from '../../../sections/guide/guideReferenceNeeds';
import { PhaseGuideSheet } from './PhaseGuideSheet';
import { PracticeNoteSheet } from './PracticeNoteSheet';
import { SchemaGuideSheet } from './SchemaGuideSheet';
import { TechniqueSheet } from './TechniqueSheet';

const tr = (_ty: string, vy: string) => vy;
const noop = () => {};
const CTX: GuideMarkCtx = { selected: null, select: noop, onMark: noop, onUnmark: noop };

// Листы без статьи-адреса: потребность (её нет среди видов статьи), каркас (разделы приходят пропсами)
// и лист отметки копинга (форма отметки, не раздел справочника).
const NO_ARTICLE = new Set(['GuideSheet.tsx', 'CopingMarkSheet.tsx']);
// Раздел-обёртка без своего текста: адреса — у каналов внутри (GuidePoints).
const WRAPPERS = ['Как работать'];

describe('листы справочника рисуют разделы только через GuideSection', () => {
  const sheets = readdirSync(__dirname).filter((f) => /Sheet\.tsx$/.test(f) && !f.includes('.test.'));

  it.each(sheets)('%s: нет разделов и подписей разделов руками', (file) => {
    const src = readFileSync(join(__dirname, file), 'utf8');
    expect(src).not.toMatch(/<section\b|<h3\b|gd-section|gd-label/);
  });

  it.each(sheets.filter((f) => !NO_ARTICLE.has(f)))('%s: у каждого раздела есть адрес', (file) => {
    const src = readFileSync(join(__dirname, file), 'utf8');
    const tags = src.match(/<GuideSection\b[^>]*>/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      if (WRAPPERS.some((w) => tag.includes(`"${w}"`))) continue;
      expect(tag).toMatch(/address=/);
    }
  });
});

function shown(node: ReactNode): string[] {
  render(<MemoryRouter><GuideMarkContext.Provider value={CTX}>{node}</GuideMarkContext.Provider></MemoryRouter>);
  const more = screen.queryByRole('button', { name: 'Подробнее' });
  if (more) fireEvent.click(more);
  const out = [...document.querySelectorAll('[data-address]')].map((el) => el.getAttribute('data-address')!);
  cleanup();
  return out;
}

const sheet = { onOpenTechnique: noop, onClose: noop };

describe('адрес каждого раздела на листе находит свой текст', () => {
  it.each([
    ['schema', () => guide.buildSchemaGuides(tr).map((g) => <SchemaGuideSheet key="s" schemaName="x" view={resolveSchemaGuide(guide, tr, g.schemaId)!} {...sheet} />)],
    ['mode', () => guide.buildModeGuides(tr).map((g) => <ModeGuideSheet key="m" modeName="x" view={resolveModeGuide(guide, tr, g.modeId)!} {...sheet} />)],
    ['technique', () => guide.buildTechniqueGuides(tr).map((t) => <TechniqueSheet key="t" technique={t} onClose={noop} />)],
    ['note', () => guide.practiceNotes(tr).map((n) => <PracticeNoteSheet key="n" note={n} onClose={noop} />)],
    ['concern', () => guide.buildConcernGuides(tr).map((c) => <ConcernGuideSheet key="c" concern={c} onClose={noop} />)],
    ['phase', () => guide.buildPhaseGuides(tr).map((p, _i, all) => <PhaseGuideSheet key="p" view={phaseView(guide, tr, all, p.id)!} onOpenMode={noop} onOpenTechnique={noop} onOpenNote={noop} onOpenPhase={noop} onClose={noop} />)],
    ['need', () => buildNeedGuides(guide, tr).map((n) => <NeedGuideSheet key="n" need={n} onOpenSchema={noop} onClose={noop} />)],
  ] as const)('%s', (_kind, build) => {
    const addresses = build().flatMap(shown);
    expect(addresses.length).toBeGreaterThan(0);
    const broken = addresses.filter((a) => !guide.resolveAddress(a, tr));
    expect(broken).toEqual([]);
  });
});
