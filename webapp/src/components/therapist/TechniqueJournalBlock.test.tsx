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
import type { ConceptModeLink, ConceptSchemaLink } from '../../../../shared/src/apiTypes';
import { TechniqueJournalBlock } from './TechniqueJournalBlock';
import type { TherapistNote } from '../../../../shared/src/apiTypes';
import type { TherapistNotesPage } from '../../../../shared/src/therapy/notesPage';
import type { SessionWorkItem } from '../../../../shared/src/therapy/sessionWork/types';
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
vi.mock('../../api', () => ({ api: { trackEvent: vi.fn(), getSessionWork: vi.fn(), listCustomModes: vi.fn() }, reportClientError: vi.fn() }));
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

function setup({ modeLinks = [critic] as ConceptModeLink[], schemaLinks = [abandonment] as ConceptSchemaLink[], failed = false, conceptLink = true, takeFocus = undefined as (() => boolean) | undefined, notesPage = undefined as TherapistNotesPage | undefined } = {}) {
  const onOpenConcept = vi.fn();
  const onOpenSession = vi.fn();
  const detail = {
    concept: { schemaIds: [], modeIds: [], modeLinks, schemaLinks },
    localConcept: {},
    activeSchemaIds: [],
    patchConcept: vi.fn(),
    clientTasks: [],
    conceptLoad: { failed, reloading: false },
    reloadConcept: vi.fn(),
    ...(notesPage && { notesPage, notes: notesPage.notes, selectedClient: { telegramId: 42 } }),
  };
  render(
    <MemoryRouter>
      <TechniqueJournalBlock detail={detail as unknown as ClientDetail} onOpenConcept={conceptLink ? onOpenConcept : undefined} takeFocus={takeFocus} onOpenSession={onOpenSession} />
    </MemoryRouter>,
  );
  return { detail, onOpenConcept, onOpenSession };
}

describe('TechniqueJournalBlock', () => {
  it('пусто: тихая строка, где ставится отметка, и переход на «Концептуализацию»', () => {
    const { onOpenConcept } = setup({ modeLinks: [emptyModeLink('punitive_critic')], schemaLinks: [] });
    expect(screen.getByRole('region', { name: 'На сессиях' })).toBeTruthy();
    expect(screen.getByText(/^Пока пусто\. Пункты появляются из «Что делали» в итогах сессии/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Открыть концептуализацию →' }));
    expect(onOpenConcept).toHaveBeenCalledTimes(1);
  });

  it('пусто без перехода — только строка', () => {
    setup({ modeLinks: [], schemaLinks: [], conceptLink: false });
    expect(screen.getByText(/Пока пусто/)).toBeTruthy();
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
    expect(screen.queryByText(/Пока пусто/)).toBeNull();
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

  // ─── Пункты «Что делали» из итогов сессий (#1330) ───────────────────────
  const workItem = (over: Partial<SessionWorkItem> = {}): SessionWorkItem => ({
    id: 'w1', kind: 'technique', refId: 'chairwork', modeIds: ['punitive_critic'], schemaIds: [], needIds: [], fields: {}, ...over,
  });
  const note = (id: number, date: string, work: SessionWorkItem[]) =>
    ({ id, date, text: '', createdAt: `${date}T10:00:00Z`, work }) as TherapistNote;

  it('пункт итогов и отметка за тот же день не двоятся; упражнение и «своё» — в том же журнале', async () => {
    const notesPage = {
      notes: [
        note(3, '2026-11-06', [workItem({ id: 'e', kind: 'exercise', refId: 'safe', modeIds: [] }), workItem({ id: 'c', kind: 'custom', customName: 'Рисунок', modeIds: [] })]),
        note(2, '2026-11-05', [workItem()]),
      ],
      total: 2,
    };
    setup({ notesPage });
    const days = await screen.findAllByRole('listitem');
    expect(days.map((d) => d.firstElementChild?.textContent)).toEqual(['7 ноя', '6 ноя', '5 ноя']);
    expect(within(days[1]).getAllByRole('button').map((b) => b.textContent)).toEqual(['Безопасное место', 'Рисунок']);
    // 5 ноя: стулья с Критиком — одна строка (пункт итогов), отметка схемы осталась.
    expect(within(days[2]).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      '5 ноя: Работа со стульями — Судья (Карающий Критик), запись сессии',
      '5 ноя: Работа со стульями — Покинутость / Нестабильность',
    ]);
    expect(api.getSessionWork).not.toHaveBeenCalled(); // всё показано — ручка не нужна
    expect(api.listCustomModes).not.toHaveBeenCalled();
  });

  it('тап по пункту итогов открывает запись сессии', async () => {
    const { onOpenSession } = setup({ modeLinks: [], schemaLinks: [], notesPage: { notes: [note(2, '2026-11-05', [workItem()])], total: 1 } });
    fireEvent.click(await screen.findByRole('button', { name: /запись сессии$/ }));
    expect(onOpenSession).toHaveBeenCalledWith(2);
    expect(api.trackEvent).toHaveBeenCalledWith(CONCEPT_GUIDE_JOURNAL_ENTRY_EVENT);
  });

  it('у клиента есть ранние записи — их пункты приходят ручкой и стоят строкой без перехода', async () => {
    vi.mocked(api.getSessionWork).mockResolvedValue({ entries: [{ noteId: 1, date: '2026-01-09', work: [workItem({ modeIds: [] })] }] });
    setup({ modeLinks: [], schemaLinks: [], notesPage: { notes: [note(2, '2026-11-05', [workItem()])], total: 2 } });
    expect(await screen.findByText('9 янв')).toBeTruthy();
    expect(api.getSessionWork).toHaveBeenCalledWith(42);
    expect(screen.getAllByRole('button', { name: /Работа со стульями/ })).toHaveLength(1); // ранняя запись на «Сессиях» не показана
  });

  it('ранние записи не загрузились — журнал честно неполный', async () => {
    vi.mocked(api.getSessionWork).mockRejectedValue(new Error('offline'));
    setup({ modeLinks: [], schemaLinks: [], notesPage: { notes: [note(2, '2026-11-05', [workItem()])], total: 2 } });
    expect(await screen.findByText(/Пункты из ранних записей сессий не загрузились/)).toBeTruthy();
  });

  it('лист техники из журнала считает и дни из итогов сессий', async () => {
    setup({ notesPage: { notes: [note(2, '2026-11-03', [workItem()])], total: 1 } });
    fireEvent.click(await screen.findByRole('button', { name: '5 ноя: Работа со стульями — Судья (Карающий Критик)' }));
    const sheet = await screen.findByRole('dialog', { name: 'Работа со стульями' });
    expect(within(sheet).getByText('делали 2 раза, последний 5 ноя')).toBeTruthy();
  });

  it('свой режим терапевта в пункте — подписан в строке журнала; без своих режимов они не грузятся', async () => {
    vi.mocked(api.listCustomModes).mockResolvedValue([{ id: 5, name: 'Тихий Наблюдатель' }] as never);
    setup({ modeLinks: [], schemaLinks: [], notesPage: { notes: [note(2, '2026-11-05', [workItem({ modeIds: ['cm_5'] })])], total: 1 } });
    expect(await screen.findByRole('button', { name: '5 ноя: Работа со стульями — Тихий Наблюдатель, запись сессии' })).toBeTruthy();
  });
});
