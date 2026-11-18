// @vitest-environment jsdom
// Общий поиск в кабинете терапевта: листы «Справочника» в палитре. Запрос по названию схемы даёт
// группу «Справочник», выбор строки ведёт на /cabinet/guide с kind и id листа в состоянии маршрута
// и шлёт search_result_open без текста запроса; чип-пример подставляет запрос. Разделы — фикстура.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import { getSchemaById } from '../../../shared/src/schemaTherapy/schemaTherapyData';
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
vi.mock('../api', () => ({
  api: {
    getTherapyClients: () => Promise.resolve([]), trackEvent: (...a: unknown[]) => trackEvent(...a),
    getTasks: () => Promise.resolve([]), getPlanHistory: () => Promise.resolve([]),
  },
}));

const SCHEMA = getSchemaById('abandonment')!.name;
const PLACEHOLDER = 'Клиент, вкладка, задание, лист справочника…';

function Where() {
  const { pathname, state } = useLocation();
  return <output data-testid="where">{pathname} {JSON.stringify((state as { guideSheet?: unknown } | null)?.guideSheet ?? null)}</output>;
}

function renderPalette(props: Partial<Parameters<typeof CommandPalette>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={['/cabinet']}>
      <CommandPalette onNavigate={vi.fn()} onClose={vi.fn()} userRole="THERAPIST" therapistMode {...props} />
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
afterEach(cleanup);

describe('CommandPalette — листы справочника', () => {
  it('название схемы → группа «Справочник»; выбор ведёт на лист и шлёт событие без текста запроса', async () => {
    renderPalette();
    await screen.findByRole('button', { name: SCHEMA }); // тексты загрузились: чип-пример
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'покинутость' } });
    expect(screen.getByText('Справочник', { selector: '.cmd-group' })).toBeTruthy();
    // совпадение подсвечено — подпись разбита на куски, ищем по тексту целиком
    fireEvent.click(screen.getByText((_t, el) => el?.className === 'cmd-label' && el.textContent === SCHEMA));
    expect(screen.getByTestId('where').textContent).toBe('/cabinet/guide {"kind":"schema","id":"abandonment"}');
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith(SEARCH_RESULT_OPEN_EVENT, { kind: 'guide', typed: true, recent: false });
    expect(JSON.stringify(trackEvent.mock.calls)).not.toContain('покинутость');
  });

  it('чип-пример подставляет запрос в поле; раздел кабинета открывается по адресу, typed=false', async () => {
    renderPalette();
    fireEvent.click(await screen.findByRole('button', { name: SCHEMA }));
    const input = screen.getByPlaceholderText<HTMLInputElement>(PLACEHOLDER);
    expect(input.value).toBe(SCHEMA);
    expect(screen.getByText('Справочник', { selector: '.cmd-group' })).toBeTruthy();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByText('Задания'));
    expect(screen.getByTestId('where').textContent).toBe('/cabinet/tasks null');
    expect(trackEvent).toHaveBeenCalledWith(SEARCH_RESULT_OPEN_EVENT, { kind: 'section', typed: false, recent: false });
  });

  it('в режиме клиента у терапевта листов справочника нет: схема находится в «Схемах» клиента', () => {
    renderPalette({ therapistMode: false });
    fireEvent.change(screen.getByPlaceholderText('Клиент, схема, упражнение, раздел…'), { target: { value: 'покинутость' } });
    expect(screen.getByText('Схемы', { selector: '.cmd-group' })).toBeTruthy();
    expect(screen.queryByText('Справочник', { selector: '.cmd-group' })).toBeNull();
  });
});

describe('CommandPalette — «Недавнее»', () => {
  it('открытый лист при следующем открытии палитры — в «Недавнем»; выбор оттуда шлёт recent=true', async () => {
    const first = renderPalette();
    await screen.findByRole('button', { name: SCHEMA });
    expect(screen.queryByText('Недавнее')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'покинутость' } });
    fireEvent.click(screen.getByRole('option', { name: new RegExp(SCHEMA) }));
    expect(localStorage.getItem('search_recent')).toBe('["guide:schema:abandonment"]');
    first.unmount();

    renderPalette();
    await screen.findByRole('button', { name: SCHEMA });
    const group = screen.getByRole('group', { name: 'Недавнее' });
    expect(document.querySelector('[role="group"]')).toBe(group);
    fireEvent.click(within(group).getByRole('option', { name: new RegExp(SCHEMA) }));
    expect(trackEvent).toHaveBeenLastCalledWith(SEARCH_RESULT_OPEN_EVENT, { kind: 'guide', typed: false, recent: true });
  });
});
