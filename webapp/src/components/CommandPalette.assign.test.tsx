// @vitest-environment jsdom
// Общий поиск в кабинете: двухшаговое «Дать задание». Строка каталога и действие палитру не закрывают,
// а ведут к шагу «Кому дать задание?»; выбор клиента — переход в его «Задания» с пунктом каталога в
// состоянии маршрута. Событие и «Недавнее» — только за первый шаг.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import { SEARCH_RESULT_OPEN_EVENT } from '../../../shared/src/share/searchAnalytics';

vi.mock('../../../shared/src/schemaTherapy/guide', async () => {
  const f = await import('../../../shared/src/therapy/conceptGraph/conceptGuide.fixture');
  return {
    buildModeGuides: () => [f.FIXTURE_GUIDE],
    buildSchemaGuides: () => [],
    buildSchemaDomainGuides: () => [{ domainId: 'rejection', note: f.FIXTURE_DOMAIN_NOTE, schemas: [f.FIXTURE_SCHEMA_GUIDE] }],
    buildTechniqueGuides: () => f.FIXTURE_TECHNIQUES,
    practiceNotes: () => [f.FIXTURE_PRACTICE_NOTE],
  };
});
const trackEvent = vi.fn();
const client = (telegramId: number, name: string, urlCode: string) => ({
  telegramId, name, urlCode, clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null, recentIndexHistory: [],
  relationCreatedAt: '2026-01-01', therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [],
});
vi.mock('../auth/authContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));
vi.mock('../api', () => ({
  api: {
    getTherapyClients: () => Promise.resolve([client(1, 'Анна', 'aaaabbbb'), client(2, 'Борис', 'ccccdddd')]),
    trackEvent: (...a: unknown[]) => trackEvent(...a), listArticles: () => Promise.resolve([]),
  },
}));

const TASK = 'Встреча со своим маленьким Я';
const TASK_ID = 'встреча-со-своим-маленьким-я';
const STEP = 'Кому дать задание?';
const onClose = vi.fn();

function Where() {
  const { pathname, state } = useLocation();
  return <output data-testid="where">{pathname} {JSON.stringify((state as { assignTask?: unknown; addClient?: unknown } | null) ?? null)}</output>;
}
const where = () => screen.getByTestId('where').textContent;

async function openPalette() {
  render(
    <MemoryRouter initialEntries={['/cabinet/guide']}>
      <CommandPalette onNavigate={vi.fn()} onClose={onClose} userRole="THERAPIST" therapistMode />
      <Where />
    </MemoryRouter>,
  );
  await screen.findByText('Анна');
  return screen.getByRole<HTMLInputElement>('combobox');
}

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
afterEach(cleanup);

describe('CommandPalette — «Дать задание» в два шага', () => {
  it('задание из справочника → «Кому?» → клиент: переход в его «Задания» с пунктом каталога', async () => {
    const input = await openPalette();
    fireEvent.change(input, { target: { value: 'встреча' } });
    fireEvent.click(within(await screen.findByRole('group', { name: 'Задания из справочника' })).getByRole('option', { name: new RegExp(TASK) }));
    // палитра открыта, шаг сменился: запрос очищен, в списке только клиенты
    expect(onClose).not.toHaveBeenCalled();
    expect(input.placeholder).toBe(STEP);
    expect(input.value).toBe('');
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Кому дать задание']);
    expect(trackEvent).toHaveBeenCalledWith(SEARCH_RESULT_OPEN_EVENT, { kind: 'task', typed: true, recent: false });
    expect(localStorage.getItem('search_recent')).toBe(`["task:${TASK_ID}"]`);

    fireEvent.change(input, { target: { value: 'бор' } });
    fireEvent.click(screen.getByRole('option', { name: /Борис/ }));
    const preset = { type: 'custom', text: `${TASK}\nПять минут в день побыть рядом с детским образом`, catalogId: TASK_ID };
    expect(where()).toBe(`/cabinet/ccccdddd/tasks ${JSON.stringify({ assignTask: { preset } })}`);
    // второй шаг — ни события, ни записи в «Недавнее»
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('search_recent')).toBe(`["task:${TASK_ID}"]`);
  });

  it('действие «Дать задание» — тот же шаг без пункта каталога; Backspace в пустом поле возвращает к поиску', async () => {
    const input = await openPalette();
    fireEvent.click(screen.getByRole('option', { name: /Дать задание/ }));
    expect(input.placeholder).toBe(STEP);
    fireEvent.change(input, { target: { value: 'яяя' } });
    expect(screen.getByText('Клиент с таким именем не нашёлся')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(input.placeholder).toBe(STEP); // в поле ещё есть текст — стирается он
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(input.placeholder).not.toBe(STEP);

    fireEvent.click(screen.getByRole('option', { name: /Дать задание/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Назад' })); // телефон: «Отмена» на втором шаге — шаг назад
    expect(input.placeholder).not.toBe(STEP);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('option', { name: /Дать задание/ }));
    fireEvent.click(screen.getByRole('option', { name: /Анна/ }));
    expect(where()).toBe('/cabinet/aaaabbbb/tasks {"assignTask":{}}');
  });

  it('Enter в поле запускает выбранную строку: всплытие гасит панель, палитра слушает на перехвате', async () => {
    const input = await openPalette();
    fireEvent.change(input, { target: { value: 'добавить' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(where()).toBe('/cabinet {"addClient":true}');
  });

  it('«Добавить клиента» ведёт к списку с открытой формой', async () => {
    await openPalette();
    fireEvent.click(screen.getByRole('option', { name: /Добавить клиента/ }));
    expect(where()).toBe('/cabinet {"addClient":true}');
  });
});
