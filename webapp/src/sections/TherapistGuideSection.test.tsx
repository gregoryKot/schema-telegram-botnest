// @vitest-environment jsdom
// «Справочник» терапевта (#995, шаг 4): пока чанк текстов грузится — силуэт
// списка; потом режимы по группам, схемы по доменам, техники и «Для
// терапевта». Тап открывает тот же лист, что в схеме случая клиента, но без
// клиента: без «Дать заданием», отметок «Делали сегодня» и истории. События —
// cabinet_guide_*, а не concept_guide_* схемы случая. Разделы — фикстура, не
// тексты shared/src/schemaTherapy/guide/.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TherapistGuideSection } from './TherapistGuideSection';
import { CABINET_GUIDE_OPEN_EVENT, CABINET_GUIDE_SHEET_EVENTS } from '../../../shared/src/share/analytics';
import { getSchemaById } from '../../../shared/src/schemaTherapy/schemaTherapyData';

const h = vi.hoisted(() => ({
  note: {
    id: 'group_format',
    title: 'Групповой формат',
    paragraphs: ['В группе режимы видны в отношениях с другими участниками.', 'Правила группы объявляют в начале.'],
    sources: '[Фаррелл, гл. 2]',
  },
}));

vi.mock('../../../shared/src/schemaTherapy/guide', async () => {
  const f = await import('../../../shared/src/therapy/conceptGraph/conceptGuide.fixture');
  return {
    buildModeGuides: () => [f.FIXTURE_GUIDE],
    buildSchemaDomainGuides: () => [{ domainId: 'rejection', note: f.FIXTURE_DOMAIN_NOTE, schemas: [f.FIXTURE_SCHEMA_GUIDE] }],
    buildTechniqueGuides: () => f.FIXTURE_TECHNIQUES,
    practiceNotes: () => [h.note],
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
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Режимы', 'Схемы', 'Техники', 'Для терапевта']);
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

  it('техники — с описанием; лист техники из списка — без отметки', async () => {
    await mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Техники' }));
    expect(screen.getByText('Возвращаемся в детскую сцену и меняем её конец.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Рескриптинг образов/ }));
    const sheet = screen.getByRole('dialog', { name: 'Рескриптинг образов' });
    expect(within(sheet).getByText('Найти сцену')).toBeTruthy();
    expectNoClientControls();
    expect(tracked()).toContain(CABINET_GUIDE_SHEET_EVENTS.technique);
  });

  it('«Для терапевта»: заголовки разделов, тап — лист с абзацами и источниками', async () => {
    await mount();
    fireEvent.click(screen.getByRole('tab', { name: 'Для терапевта' }));
    fireEvent.click(screen.getByRole('button', { name: 'Групповой формат' }));
    const sheet = screen.getByRole('dialog', { name: 'Групповой формат' });
    for (const p of h.note.paragraphs) expect(within(sheet).getByText(p)).toBeTruthy();
    expect(within(sheet).getByText('[Фаррелл, гл. 2]')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tracked()).toContain(CABINET_GUIDE_SHEET_EVENTS.note);
  });

  it('поиск — по названиям во всех разделах сразу; без совпадений — так и сказано', async () => {
    await mount();
    const search = screen.getByRole('searchbox', { name: 'Найти в справочнике' });
    fireEvent.change(search, { target: { value: 'СТУЛ' } });
    expect(screen.queryByRole('tablist')).toBeNull();
    const found = screen.getByRole('region', { name: 'Техники' });
    expect(within(found).getByRole('button', { name: /^Работа со стульями/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Уязвимый Ребёнок' })).toBeNull();
    fireEvent.change(search, { target: { value: 'щщщ' } });
    expect(screen.getByText('Ничего не нашлось')).toBeTruthy();
    fireEvent.change(search, { target: { value: '' } });
    expect(screen.getByRole('tablist')).toBeTruthy();
  });
});
