// @vitest-environment jsdom
// «На сессиях» во вкладке «Задания» (#995): журнал техник из отметок «Делали
// сегодня» связей концептуализации. Пусто — тихая строка и переход на
// «Концептуализацию»; строки по дням, новые сверху, режим со словами клиента —
// как в «Коротко»; тап — лист техники с днём строки, где отметку снимают той
// же правкой связи (patchConcept). Тексты техник — фикстура.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ClientDetail } from './clientSheetTypes';
import { TechniqueJournalBlock } from './TechniqueJournalBlock';
import { emptyModeLink } from '../../../../shared/src/therapy/conceptGraph/modeLinks';
import { emptySchemaLink } from '../../../../shared/src/therapy/conceptGraph/schemaLinks';
import { CONCEPT_GUIDE_JOURNAL_ENTRY_EVENT } from '../../../../shared/src/share/analytics';

vi.mock('../../../../shared/src/schemaTherapy/guide', async () => {
  const f = await import('../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture');
  return {
    buildTechniqueGuides: () => f.FIXTURE_TECHNIQUES,
    techniqueGuide: (_tr: unknown, id: string) => f.FIXTURE_TECHNIQUES.find((t) => t.id === id) ?? null,
    modeGuide: () => null,
    schemaGuide: () => null,
  };
});
vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
  vi.mocked(api.trackEvent).mockClear();
});
afterEach(() => vi.useRealTimers());

const critic = {
  ...emptyModeLink('punitive_critic'), alias: 'Судья',
  done: [{ techniqueId: 'chairwork', day: '2026-11-05' }, { techniqueId: 'imagery_rescripting', day: '2026-11-07' }],
};
const abandonment = { ...emptySchemaLink('abandonment'), done: [{ techniqueId: 'chairwork', day: '2026-11-05' }] };

function setup({ modeLinks = [critic], schemaLinks = [abandonment], failed = false, conceptLink = true, takeFocus = undefined as (() => boolean) | undefined } = {}) {
  const onOpenConcept = vi.fn();
  const detail = {
    concept: { schemaIds: [], modeIds: [], modeLinks, schemaLinks },
    localConcept: {},
    activeSchemaIds: [],
    patchConcept: vi.fn(),
    clientTasks: [],
    conceptLoad: { failed, reloading: false },
    reloadConcept: vi.fn(),
  };
  render(
    <MemoryRouter>
      <TechniqueJournalBlock detail={detail as unknown as ClientDetail} onOpenConcept={conceptLink ? onOpenConcept : undefined} takeFocus={takeFocus} />
    </MemoryRouter>,
  );
  return { detail, onOpenConcept };
}

describe('TechniqueJournalBlock', () => {
  it('пусто: тихая строка, где ставится отметка, и переход на «Концептуализацию»', () => {
    const { onOpenConcept } = setup({ modeLinks: [emptyModeLink('punitive_critic')], schemaLinks: [] });
    expect(screen.getByRole('region', { name: 'На сессиях' })).toBeTruthy();
    expect(screen.getByText('Пока не отмечали. Отметка ставится в листе техники в концептуализации.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Открыть концептуализацию →' }));
    expect(onOpenConcept).toHaveBeenCalledTimes(1);
  });

  it('пусто без перехода — только строка', () => {
    setup({ modeLinks: [], schemaLinks: [], conceptLink: false });
    expect(screen.getByText(/Пока не отмечали/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /концептуализацию/ })).toBeNull();
  });

  it('строки по дням, новые сверху: день один раз, «Техника — режим (как в «Коротко»)» и схема', async () => {
    setup();
    const days = await screen.findAllByRole('listitem');
    expect(days.map((d) => d.firstElementChild?.textContent)).toEqual(['7 ноя', '5 ноя']);
    expect(within(days[0]).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Рескриптинг образов — Судья (Карающий Критик)',
    ]);
    expect(within(days[1]).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Работа со стульями — Судья (Карающий Критик)',
      'Работа со стульями — Покинутость / Нестабильность',
    ]);
  });

  it('тап по прошлой строке: лист техники про день строки, отметка того дня снимается правкой связи', async () => {
    const { detail } = setup();
    fireEvent.click(await screen.findByRole('button', { name: '5 ноя: Работа со стульями — Судья (Карающий Критик)' }));
    expect(api.trackEvent).toHaveBeenCalledWith(CONCEPT_GUIDE_JOURNAL_ENTRY_EVENT);
    const sheet = await screen.findByRole('dialog', { name: 'Работа со стульями' });
    expect(within(sheet).getByText('делали 5 ноя')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Снять отметку за 5 ноя' }));
    expect(detail.patchConcept).toHaveBeenCalledWith({
      modeLinks: [{ ...critic, done: [critic.done[1]] }],
    });
    // из журнала «журнал →» не нужен — мы уже в нём
    expect(within(sheet).queryByRole('button', { name: /Журнал техник/ })).toBeNull();
  });

  it('тап по сегодняшней строке — та же кнопка, что из схемы случая', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: '7 ноя: Рескриптинг образов — Судья (Карающий Критик)' }));
    const sheet = await screen.findByRole('dialog', { name: 'Рескриптинг образов' });
    expect(within(sheet).getByRole('button', { name: 'Отменить сегодняшнюю отметку' })).toBeTruthy();
  });

  it('концептуализация не загрузилась — не «пусто», а сбой с «Повторить»', () => {
    const { detail } = setup({ failed: true });
    expect(screen.queryByText(/Пока не отмечали/)).toBeNull();
    expect(screen.getByText('Журнал не загрузился вместе с концептуализацией.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(detail.reloadConcept).toHaveBeenCalledTimes(1);
  });

  it('открыли «журнал →» — блок прокручивается в вид один раз', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    setup({ takeFocus: () => true });
    expect(scroll).toHaveBeenCalledTimes(1);
    scroll.mockClear();
    setup({ takeFocus: () => false });
    expect(scroll).not.toHaveBeenCalled();
  });
});
