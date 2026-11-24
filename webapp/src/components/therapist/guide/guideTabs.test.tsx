// @vitest-environment jsdom
// Вкладки листа справочника: таблица «раздел → вкладка» (guideTabsModel.ts) совпадает с тем, где лист на самом деле
// рисует раздел (правило №4), вкладки переключаются на месте, пустая не показывается, отметка клиента — точкой.
import { describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import * as guide from '../../../../../shared/src/schemaTherapy/guide';
import { parseAddress } from '../../../../../shared/src/schemaTherapy/guide/address/addressFormat';
import { resolveModeGuide, resolveSchemaGuide } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { GuideMarkContext, type GuideMarkCtx } from './marks/GuideSectionMark';
import { GuideSection } from './GuideSection';
import { GuideTabs } from './GuideTabs';
import { ModeGuideSheet } from './ModeGuideSheet';
import { SchemaGuideSheet } from './SchemaGuideSheet';
import { ConcernGuideSheet } from './ConcernGuideSheet';
import { TechniqueSheet } from './TechniqueSheet';
import { markedTabs, tabOfPath, type TabbedKind } from './guideTabsModel';

const tr = (_ty: string, vy: string) => vy;
const noop = () => {};
const CTX: GuideMarkCtx = { selected: null, select: noop, onMark: noop, onUnmark: noop };

describe('guideTabsModel', () => {
  it('поле — на своей вкладке, подпуть — по первому слову, незнакомое — на «Теории»', () => {
    expect(tabOfPath('mode', 'goal')).toBe('brief');
    expect(tabOfPath('mode', 'experiential')).toBe('session');
    expect(tabOfPath('schema', 'coping.surrender')).toBe('theory');
    expect(tabOfPath('technique', 'steps')).toBe('steps');
    expect(tabOfPath('concern', 'differential')).toBe('diagnosis');
    expect(tabOfPath('mode', 'nope')).toBe('theory');
  });

  it('вкладки с отметками — только своей статьи', () => {
    const marks = ['mode:pc/goal', 'mode:pc/betweenSessions', 'mode:other/stuck', 'schema:pc/need', 'мусор'];
    expect([...markedTabs('mode', 'pc', marks)].sort()).toEqual(['between', 'brief']);
  });
});

/** Пары «адрес раздела — вкладка, где он нарисован» по всем листам вида. */
function placed(node: ReactNode): [string, string][] {
  render(<MemoryRouter><GuideMarkContext.Provider value={CTX}>{node}</GuideMarkContext.Provider></MemoryRouter>);
  const out = [...document.querySelectorAll('[data-address]')].map((el) => [
    el.getAttribute('data-address')!, el.closest('[data-tab]')?.getAttribute('data-tab') ?? '—',
  ] as [string, string]);
  cleanup();
  return out;
}

const sheet = { onOpenTechnique: noop, onClose: noop };

describe('лист кладёт раздел на вкладку из таблицы', () => {
  it.each([
    ['schema', () => guide.buildSchemaGuides(tr).map((g) => <SchemaGuideSheet key="s" schemaName="x" view={resolveSchemaGuide(guide, tr, g.schemaId)!} {...sheet} />)],
    ['technique', () => guide.buildTechniqueGuides(tr).map((t) => <TechniqueSheet key="t" technique={t} usages={guide.techniqueUsageGroups(tr, t.id)} onClose={noop} />)],
    ['concern', () => guide.buildConcernGuides(tr).map((c) => (
      <ConcernGuideSheet
        key="c" concern={c} techniques={(c.techniques ?? []).flatMap((id) => guide.techniqueGuide(tr, id) ?? [])}
        onOpenMode={noop} onOpenSchema={noop} onOpenTechnique={noop} onClose={noop}
      />
    ))],
    ['mode', () => guide.buildModeGuides(tr).map((g) => <ModeGuideSheet key="m" modeName="x" view={resolveModeGuide(guide, tr, g.modeId)!} {...sheet} />)],
  ] as const)('%s', (kind, build) => {
    const pairs = build().flatMap(placed);
    expect(pairs.length).toBeGreaterThan(0);
    const wrong = pairs.filter(([address, tab]) => tabOfPath(kind as TabbedKind, parseAddress(address)!.path) !== tab);
    expect(wrong).toEqual([]);
  });
});

describe('GuideTabs', () => {
  const panels = {
    brief: <GuideSection title="Цель" text="Суть" address="mode:pc/goal" />,
    session: <GuideSection title="Каналы" text="Работа" address="mode:pc/cognitive" />,
    between: <GuideSection title="Пусто" text="" />,
  };
  const tabs = (ctx: GuideMarkCtx = CTX) => render(
    <GuideMarkContext.Provider value={ctx}><GuideTabs kind="mode" articleId="pc" panels={panels} /></GuideMarkContext.Provider>,
  );

  it('пустая вкладка не показывается; тап меняет вкладку на месте, остальные скрыты до поиска', () => {
    tabs();
    const bar = screen.getByRole('tablist', { name: 'Разделы листа' });
    expect(within(bar).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Кратко', 'На сессии']);
    const session = screen.getByText('Работа').closest('[data-tab]')!;
    expect(session.getAttribute('hidden')).toBe('until-found');
    fireEvent.click(within(bar).getByRole('tab', { name: 'На сессии' }));
    expect(session.hasAttribute('hidden')).toBe(false);
    expect(screen.getByText('Суть').closest('[data-tab]')!.getAttribute('hidden')).toBe('until-found');
  });

  it('поиск браузера нашёл текст на скрытой вкладке — она открывается', () => {
    tabs();
    const session = screen.getByText('Работа').closest('[data-tab]')!;
    fireEvent(session, new Event('beforematch'));
    expect(screen.getByRole('tab', { name: 'На сессии' }).getAttribute('aria-selected')).toBe('true');
  });

  it('стрелки ходят по вкладкам по кругу', () => {
    tabs();
    const brief = screen.getByRole('tab', { name: 'Кратко' });
    fireEvent.keyDown(brief, { key: 'ArrowLeft' });
    const session = screen.getByRole('tab', { name: 'На сессии' });
    expect(session.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(session);
    fireEvent.keyDown(session, { key: 'ArrowRight' });
    expect(brief.getAttribute('aria-selected')).toBe('true');
  });

  it('вкладка с отметкой клиента — с точкой', () => {
    const mark = { id: 1, address: 'mode:pc/cognitive', note: '', snapshot: '' } as never;
    tabs({ ...CTX, client: { name: 'Елена', marked: new Map([['mode:pc/cognitive', mark]]) } });
    expect(screen.getByRole('tab', { name: 'На сессии' }).querySelector('.gd-tab-dot')).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Кратко' }).querySelector('.gd-tab-dot')).toBeNull();
  });
});
