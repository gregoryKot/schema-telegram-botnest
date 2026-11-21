// @vitest-environment jsdom
// «Справочник» терапевта (#995, шаг 4): пока чанк текстов грузится — силуэт
// списка; потом режимы по группам, схемы по доменам, потребности, техники и «Для
// терапевта». Тап открывает тот же лист, что в схеме случая клиента, но без
// клиента: без «Дать заданием», отметок «Делали сегодня» и истории. События —
// cabinet_guide_*, а не concept_guide_* схемы случая. Разделы — фикстура, не
// тексты shared/src/schemaTherapy/guide/.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { TherapistGuideSection } from './TherapistGuideSection';
import { CABINET_GUIDE_OPEN_EVENT, CABINET_GUIDE_SHEET_EVENTS, CABINET_GUIDE_TABLE_EVENT } from '../../../shared/src/share/analytics';
import { getSchemaById } from '../../../shared/src/schemaTherapy/schemaTherapyData';
import { CONCERNS_HINT } from './guide/guideReferenceConcerns';
import { FIXTURE_PRACTICE_NOTE as NOTE } from '../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';

vi.mock('../../../shared/src/schemaTherapy/guide', async () => {
  const f = await import('../../../shared/src/therapy/conceptGraph/conceptGuide.fixture');
  return {
    buildModeGuides: () => [f.FIXTURE_GUIDE],
    buildSchemaDomainGuides: () => [{ domainId: 'rejection', note: f.FIXTURE_DOMAIN_NOTE, schemas: [f.FIXTURE_SCHEMA_GUIDE] }],
    buildTechniqueGuides: () => f.FIXTURE_TECHNIQUES,
    practiceNotes: () => [f.FIXTURE_PRACTICE_NOTE],
    buildConcernGuides: () => [{
      id: 'bpd', name: 'Пограничное расстройство личности', goal: 'Вырастить Здорового Взрослого',
      essence: 'Нестабильность почти во всём', criteria: ['Пять из девяти признаков'], sources: '[Арнтц ПРЛ, гл. 1]',
    }],
    modeGuide: (_tr: unknown, id: string) => (id === 'vulnerable_child' ? f.FIXTURE_GUIDE : null),
    schemaGuide: (_tr: unknown, id: string) =>
      id === 'abandonment' ? { guide: f.FIXTURE_SCHEMA_GUIDE, domainNote: f.FIXTURE_DOMAIN_NOTE } : null,
    techniqueGuide: (_tr: unknown, id: string) => f.FIXTURE_TECHNIQUES.find((t) => t.id === id) ?? null,
  };
});
vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../api';

const trackEvent = api.trackEvent as unknown as ReturnType<typeof vi.fn>;
const tracked = () => trackEvent.mock.calls.map((c) => c[0]);
const SCHEMA_NAME = getSchemaById('abandonment')!.name;

beforeEach(() => vi.clearAllMocks());

async function mount() {
  const view = render(<MemoryRouter><TherapistGuideSection /></MemoryRouter>);
  await screen.findByRole('tab', { name: 'Режимы' });
  return view;
}

/** Лист без клиента: ни «Дать заданием», ни отметки техники. */
function expectNoClientControls() {
  expect(screen.queryByRole('button', { name: /Дать заданием/ })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Делали сегодня' })).toBeNull();
  expect(screen.queryByText('Пока не отмечали')).toBeNull();
}

describe('TherapistGuideSection', () => {
  it('пока тексты грузятся — силуэт списка; потом «откуда и зачем» и режимы по группам', async () => {
    const { container } = render(<MemoryRouter><TherapistGuideSection /></MemoryRouter>);
    expect(container.querySelector('.skel')).not.toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    const group = await screen.findByRole('region', { name: 'Детские режимы' });
    expect(container.querySelector('.skel')).toBeNull();
    expect(within(group).getByRole('button', { name: 'Уязвимый Ребёнок' })).toBeTruthy();
    // режим без своего раздела в справочнике в список не попадает
    expect(screen.queryByRole('button', { name: 'Одинокий Ребёнок' })).toBeNull();
    expect(screen.getByText(/по книгам схема-терапии/)).toBeTruthy();
    // оговорка об источниках и адрес для ошибок — сразу под шапкой (на сайте — Telegram автора)
    expect(screen.getByText(/могут содержать ошибки/).textContent).toMatch(/обязательно напиши: @kotlarewski$/);
    expect(screen.getByRole('link', { name: '@kotlarewski' }).getAttribute('href')).toBe('https://t.me/kotlarewski');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Режимы', 'Схемы', 'Потребности', 'Техники', 'Запросы', 'Для терапевта']);
    expect(tracked()).toEqual([CABINET_GUIDE_OPEN_EVENT]);
  });

  it('лист режима — без заданий и истории; техника из него — без отметки', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Уязвимый Ребёнок' }));
    const sheet = screen.getByRole('dialog', { name: 'Уязвимый Ребёнок' });
    expect(within(sheet).getByText('Письмо себе')).toBeTruthy();
    expectNoClientControls();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Работа со стульями' }));
    expect(screen.getByRole('dialog', { name: 'Работа со стульями' })).toBeTruthy();
    expectNoClientControls();
    expect(tracked()).toEqual([CABINET_GUIDE_OPEN_EVENT, CABINET_GUIDE_SHEET_EVENTS.mode, CABINET_GUIDE_SHEET_EVENTS.technique]);
  });

  it('схемы по доменам; лист схемы — без «Дать заданием»', async () => {
    await mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Схемы' }));
    const domain = screen.getByRole('region', { name: 'Нарушение связи и отвержение' });
    fireEvent.click(within(domain).getByRole('button', { name: SCHEMA_NAME }));
    const sheet = screen.getByRole('dialog', { name: SCHEMA_NAME });
    expect(within(sheet).getByText('Дневник разлук')).toBeTruthy();
    expectNoClientControls();
    expect(tracked()).toContain(CABINET_GUIDE_SHEET_EVENTS.schema);
  });

  it('«Схемы» → «Таблицей»: описание и три копинга по домену, тап по схеме — её лист; обратно — список', async () => {
    await mount();
    expect(screen.queryByRole('button', { name: 'Таблицей' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Схемы' }));
    fireEvent.click(screen.getByRole('button', { name: 'Таблицей' }));
    expect(tracked()).toEqual([CABINET_GUIDE_OPEN_EVENT, CABINET_GUIDE_TABLE_EVENT]);
    const domain = screen.getByRole('region', { name: 'Нарушение связи и отвержение' });
    const row = within(domain).getByRole('row', { name: new RegExp(SCHEMA_NAME) });
    expect(within(row).getByText('Держится за ненадёжных')).toBeTruthy(); // в клетке — выжимка, не полный текст
    expect(within(row).queryByText('Выбирает недоступных партнёров')).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: /Держится за ненадёжных/ }));
    expect(within(row).getByText('Выбирает недоступных партнёров')).toBeTruthy(); // тап раскрывает полный пример
    expect(within(row).queryByText('Цепляется и контролирует')).toBeNull(); // раскрыта одна клетка
    expect(within(row).getAllByRole('button', { name: /^Про клиента/ })).toHaveLength(1); // «Про клиента» — у раскрытой клетки
    expect(within(domain).getByRole('columnheader', { name: 'Гиперкомпенсация' })).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: new RegExp(SCHEMA_NAME) }));
    expect(screen.getByRole('dialog', { name: SCHEMA_NAME })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Таблицей' }));
    expect(tracked().filter((e) => e === CABINET_GUIDE_TABLE_EVENT)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Списком' }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('техники — с описанием; лист техники из списка — без отметки', async () => {
    await mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Техники' }));
    expect(screen.getByText('Возвращаемся в детскую сцену и меняем её конец.')).toBeTruthy();
    const head = screen.getByRole('button', { name: /^Эмпирические/ }); // группа по полю group, раскрыта
    fireEvent.click(head);
    expect(screen.queryByRole('button', { name: /^Рескриптинг образов/ })).toBeNull();
    fireEvent.click(head);
    fireEvent.click(screen.getByRole('button', { name: /^Рескриптинг образов/ }));
    const sheet = screen.getByRole('dialog', { name: 'Рескриптинг образов' });
    expect(within(sheet).getByText('Найти сцену')).toBeTruthy();
    expectNoClientControls();
    expect(tracked()).toContain(CABINET_GUIDE_SHEET_EVENTS.technique);
  });

  it('«Потребности»: строка с подписью, тап — лист с доменом и схемами; схема открывается поверх, «Закрыть» возвращает к потребности', async () => {
    await mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Потребности' }));
    const rows = screen.getAllByRole('button', { name: /Привязанность/ });
    expect(rows).toHaveLength(1); // потребности без домена со схемами в справочнике в списке нет
    expect(within(rows[0]).getByText('Безопасность и связь')).toBeTruthy();
    fireEvent.click(rows[0]);
    const sheet = screen.getByRole('dialog', { name: 'Привязанность' });
    expect(within(sheet).getByText('Нарушение связи и отвержение')).toBeTruthy();
    expect(tracked()).toContain(CABINET_GUIDE_SHEET_EVENTS.need);
    fireEvent.click(within(sheet).getByRole('button', { name: new RegExp(SCHEMA_NAME.replace('/', '\\/')) }));
    const schema = screen.getByRole('dialog', { name: SCHEMA_NAME });
    expect(sheet.compareDocumentPosition(schema) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // позже в DOM — выше
    expect(tracked()).toContain(CABINET_GUIDE_SHEET_EVENTS.schema);
    fireEvent.click(within(schema).getByRole('button', { name: 'Закрыть' }));
    expect(screen.getByRole('dialog', { name: 'Привязанность' })).toBeTruthy();
  });

  it('«Для терапевта»: раздел с сутью, тап — лист с пунктами и источниками; «Закрыть» — обратно', async () => {
    await mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Для терапевта' }));
    const row = screen.getByRole('button', { name: new RegExp(`^${NOTE.title}`) });
    expect(within(row).getByText(NOTE.summary)).toBeTruthy();
    fireEvent.click(row);
    const sheet = screen.getByRole('dialog', { name: NOTE.title });
    expect(within(sheet).getByText('Для терапевта')).toBeTruthy();
    for (const p of NOTE.points) expect(within(sheet).getByText(p)).toBeTruthy();
    expect(within(sheet).getByText(NOTE.sources)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tracked()).toContain(CABINET_GUIDE_SHEET_EVENTS.note);
  });

  it('«Запросы»: подпись «что это и зачем», строка с целью, тап — лист с сутью и критериями; «Закрыть» — обратно', async () => {
    await mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Запросы' }));
    expect(screen.getByText(CONCERNS_HINT)).toBeTruthy();
    const row = screen.getByRole('button', { name: /^Пограничное расстройство личности/ });
    expect(within(row).getByText('Вырастить Здорового Взрослого')).toBeTruthy();
    fireEvent.click(row);
    const sheet = screen.getByRole('dialog', { name: 'Пограничное расстройство личности' });
    expect(within(sheet).getByText('Нестабильность почти во всём')).toBeTruthy();
    expect(within(sheet).getByRole('region', { name: 'Критерии' })).toBeTruthy();
    expect(within(sheet).getByText('Пять из девяти признаков')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tracked()).toContain(CABINET_GUIDE_SHEET_EVENTS.concern);
  });

  it('лист — панель над затемнённым списком: тап по затемнению закрывает её', async () => {
    const { container } = await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Уязвимый Ребёнок' }));
    const scrim = container.querySelector('.cfs-layer > .cfs-scrim')!;
    expect(screen.getByRole('dialog', { name: 'Уязвимый Ребёнок' }).className).toBe('cfs-panel');
    fireEvent.click(scrim);
    expect(screen.queryByRole('dialog')).toBeNull();
    // список под листом на месте: лист открывается поверх, а не вместо
    expect(screen.getByRole('region', { name: 'Детские режимы' })).toBeTruthy();
  });

  it('поиск — по названиям во всех разделах сразу; без совпадений — так и сказано', async () => {
    await mount();
    const search = screen.getByRole('searchbox', { name: 'Найти в справочнике' });
    fireEvent.change(search, { target: { value: 'СТУЛ' } });
    expect(screen.queryByRole('tablist')).toBeNull();
    const found = screen.getByRole('region', { name: 'Эмпирические' });
    expect(within(found).getByRole('button', { name: /^Работа со стульями/ })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Детские режимы' })).toBeNull(); // режим — только ссылкой в карточке-ответе
    fireEvent.change(search, { target: { value: 'щщщ' } });
    expect(screen.getByText('Ничего не нашлось')).toBeTruthy();
    fireEvent.change(search, { target: { value: '' } });
    expect(screen.getByRole('tablist')).toBeTruthy();
  });
});

// Переход из общего поиска (⌘K): состояние маршрута { guideSheet } → открыт лист, состояние очищено.
describe('лист из состояния маршрута', () => {
  function State() {
    return <output data-testid="state">{JSON.stringify(useLocation().state)}</output>;
  }
  const mountAt = async (guideSheet: unknown) => {
    render(<MemoryRouter initialEntries={[{ pathname: '/cabinet/guide', state: { guideSheet } }]}><TherapistGuideSection /><State /></MemoryRouter>);
    await screen.findByRole('tab', { name: 'Режимы' });
  };

  it('открывает лист по виду и id — тем же путём, что тап по строке; состояние маршрута очищается', async () => {
    await mountAt({ kind: 'schema', id: 'abandonment' });
    expect(await screen.findByRole('dialog', { name: SCHEMA_NAME })).toBeTruthy();
    expect(tracked()).toEqual([CABINET_GUIDE_OPEN_EVENT, CABINET_GUIDE_SHEET_EVENTS.schema]);
    expect(screen.getByTestId('state').textContent).not.toContain('guideSheet');
  });

  it('листа с таким id нет — ничего не открывается, состояние всё равно очищено', async () => {
    await mountAt({ kind: 'mode', id: 'no_such_mode' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('state').textContent).toBe('null');
  });
});
