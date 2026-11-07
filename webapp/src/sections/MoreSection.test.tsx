// @vitest-environment jsdom
// «Ещё»: каждая строка ведёт куда обещает; кабинет терапевта — только терапевту.
// Сюда с главной переехали (владелец 2026-11-05): строка «Задания» → узел заданий,
// сигнальная карточка моста к терапевту, строка «самопомощь, не замена терапии».
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MoreSection } from './MoreSection';

const trackHomeTile = vi.hoisted(() => vi.fn());
const trackNudge = vi.hoisted(() => vi.fn());
vi.mock('../components/therapy/trackTherapyNudge', () => ({ trackTherapyNudge: trackNudge }));
vi.mock('./today/trackHomeTile', () => ({ trackHomeTile }));

vi.mock('../components/HomeScreenOfferCard', () => ({ HomeScreenOfferCard: () => null }));
vi.mock('./tasks/TasksHub', () => ({
  TasksHub: (p: { onClose: () => void }) => <div data-testid="tasks-hub"><button onClick={p.onClose}>закрыть задания</button></div>,
}));
vi.mock('../api', () => ({
  api: {
    getSchemaDiary: vi.fn().mockResolvedValue([]), getModeDiary: vi.fn().mockResolvedValue([]), getGratitudeDiary: vi.fn().mockResolvedValue([]),
    history: vi.fn().mockResolvedValue([]), trackEvent: vi.fn(), updateSettings: vi.fn().mockResolvedValue(undefined),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
vi.mock('../components/JourneySheet', () => ({
  JourneySheet: (p: { onClose: () => void }) => <div data-testid="journey"><button onClick={p.onClose}>закрыть путь</button></div>,
}));
vi.mock('../components/caseFlow/CaseFlowHost', () => ({
  CaseFlowHost: (p: { start: string; onClose: () => void; onOpenTracker: () => void; onOpenSchema: (o?: { tab?: string }) => void }) => (
    <div data-testid="case-flow" data-start={p.start}>
      <button onClick={p.onClose}>закрыть карту</button>
      <button onClick={p.onOpenTracker}>трекер с карты</button>
      <button onClick={() => p.onOpenSchema({ tab: 'modes' })}>режимы с карты</button>
    </div>
  ),
}));
vi.mock('../components/WhySheet', () => ({
  WhySheet: (p: { onClose: () => void; auto?: boolean }) => <div data-testid="why" data-auto={String(!!p.auto)}><button onClick={p.onClose}>закрыть зачем</button></div>,
}));

beforeEach(() => { localStorage.clear(); trackNudge.mockClear(); mockApi.history.mockResolvedValue([]); mockApi.getModeDiary.mockResolvedValue([]); });
afterEach(cleanup);

function setup(userRole: 'CLIENT' | 'THERAPIST' = 'CLIENT') {
  const h = {
    onNavigate: vi.fn(), onOpenSchema: vi.fn(), onOpenAdvanced: vi.fn(), onOpenTherapistCabinet: vi.fn(),
    onOpenTracker: vi.fn(), onOpenDiaries: vi.fn(), onOpenChildhoodWheel: vi.fn(),
  };
  render(<MemoryRouter><MoreSection {...h} userRole={userRole} /></MemoryRouter>);
  return h;
}
const row = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}`) });

describe('MoreSection', () => {
  it('заголовок и все строки списка', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Всё остальное');
    for (const t of ['Зачем это всё', 'Задания', 'Мои паттерны', 'Карта себя', 'Практики', 'Мой путь', 'Поговорить с кем-то', 'Тест на схемы', 'Настройки', 'Профиль', 'Мне очень плохо']) {
      expect(row(t)).toBeTruthy();
    }
  });

  it('переходы: паттерны, практики, профиль (в нём же терапевт) — в свои разделы; «Мне очень плохо» — в практики', () => {
    const h = setup();
    fireEvent.click(row('Мои паттерны'));
    expect(h.onNavigate).toHaveBeenLastCalledWith('schemas');
    fireEvent.click(row('Практики'));
    expect(h.onNavigate).toHaveBeenLastCalledWith('practice');
    fireEvent.click(row('Профиль'));
    expect(h.onNavigate).toHaveBeenLastCalledWith('profile');
    fireEvent.click(row('Мне очень плохо'));
    expect(h.onNavigate).toHaveBeenLastCalledWith('practice');
  });

  it('тест на схемы запускается сразу, настройки открываются', () => {
    const h = setup();
    fireEvent.click(row('Тест на схемы'));
    expect(h.onOpenSchema).toHaveBeenCalledWith({ startTest: true });
    fireEvent.click(row('Настройки'));
    expect(h.onOpenAdvanced).toHaveBeenCalledTimes(1);
  });

  it('«Зачем это всё» и «Мой путь» открывают свои листы и закрываются', () => {
    setup();
    fireEvent.click(row('Зачем это всё'));
    expect(trackHomeTile).toHaveBeenCalledWith('why');
    expect(screen.getByTestId('why').getAttribute('data-auto')).toBe('false');
    fireEvent.click(screen.getByText('закрыть зачем'));
    expect(screen.queryByTestId('why')).toBeNull();
    fireEvent.click(row('Мой путь'));
    expect(screen.getByTestId('journey')).toBeTruthy();
    fireEvent.click(screen.getByText('закрыть путь'));
    expect(screen.queryByTestId('journey')).toBeNull();
  });

  // docs/open/frontend-ux.md: «Карту себя» было видно только с экрана «Записано» после
  // разбора — постоянного входа не было. Строка стоит рядом с «Мои паттерны» и говорит,
  // откуда карта и что на ней (правило онбординга).
  it('«Карта себя» стоит после «Мои паттерны», объясняет себя и открывает карту, а не новый разбор', () => {
    const h = setup();
    const titles = screen.getAllByRole('button').map(b => b.textContent ?? '');
    const at = titles.findIndex(t => t.startsWith('Мои паттерны'));
    expect(titles[at + 1]).toMatch(/^Карта себя/);
    expect(row('Карта себя').textContent).toContain('Из разборов: какие части включаются в трудные моменты');
    expect(screen.queryByTestId('case-flow')).toBeNull();
    fireEvent.click(row('Карта себя'));
    expect(screen.getByTestId('case-flow').getAttribute('data-start')).toBe('map');
    fireEvent.click(screen.getByText('трекер с карты'));
    expect(h.onOpenTracker).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('режимы с карты'));
    expect(h.onOpenSchema).toHaveBeenCalledWith({ tab: 'modes' });
    fireEvent.click(screen.getByText('закрыть карту'));
    expect(screen.queryByTestId('case-flow')).toBeNull();
  });

  it('строки «Терапевт» нет: он внутри «Профиля», подпись об этом говорит', () => {
    setup();
    expect(screen.queryByRole('button', { name: /^Терапевт/ })).toBeNull();
    expect(row('Профиль').textContent).toContain('Портрет, терапевт, ближайшая встреча');
  });

  it('кабинет терапевта: у клиента строки нет, у терапевта есть и ведёт в кабинет', () => {
    setup('CLIENT');
    expect(screen.queryByRole('button', { name: /Кабинет терапевта/ })).toBeNull();
    cleanup();
    const h = setup('THERAPIST');
    fireEvent.click(row('Кабинет терапевта'));
    expect(h.onOpenTherapistCabinet).toHaveBeenCalledTimes(1);
  });

  it('«Поговорить с кем-то» стоит сразу после «Мой путь» и открывает лист', () => {
    setup();
    const titles = screen.getAllByRole('button').map(b => b.textContent ?? '');
    const at = titles.findIndex(t => t.startsWith('Мой путь'));
    expect(titles[at + 1]).toMatch(/^Поговорить с кем-то/);
    expect(row('Поговорить с кем-то').textContent).toContain('Встреча с автором приложения');
    fireEvent.click(row('Поговорить с кем-то'));
    expect(trackNudge).toHaveBeenCalledWith('more', 'open', undefined);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
  });

  it('терапевт подключён: строка «Написать терапевту» — ссылка на него, событие write', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    setup();
    expect(screen.queryByRole('button', { name: /^Поговорить с кем-то/ })).toBeNull();
    const link = within(document.querySelector('.ds-card--flush') as HTMLElement).getByRole('link', { name: /^Написать терапевту/ });
    expect(link.getAttribute('href')).toBe('tg://user?id=42');
    expect(link.textContent).toContain('Связь с терапевтом');
    fireEvent.click(link);
    expect(trackNudge).toHaveBeenCalledWith('more', 'write', undefined);
  });

  it('пользователю-терапевту строки нет', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    localStorage.setItem('therapy_contact_name', 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
    setup();
    expect(screen.queryByText('Поговорить с кем-то')).toBeNull();
    expect(screen.queryByText(/Написать терапевту/)).toBeNull();
    cleanup();
    localStorage.clear();
    setup('THERAPIST');
    expect(screen.queryByText('Поговорить с кем-то')).toBeNull();
  });

  // #925: на ≥768 эти три строки дублируют левое меню и скрыты CSS-классом; на телефоне «Ещё» полное.
  it('телефонный класс (cm-phone-only) только у «Мои паттерны», «Практики», «Профиль»', () => {
    setup();
    const phone = ['Мои паттерны', 'Практики', 'Профиль'];
    for (const t of ['Зачем это всё', 'Задания', 'Мои паттерны', 'Практики', 'Мой путь', 'Поговорить с кем-то', 'Тест на схемы', 'Настройки', 'Профиль']) {
      expect([t, row(t).className.includes('cm-phone-only')]).toEqual([t, phone.includes(t)]);
    }
  });
});

describe('MoreSection — то, что переехало с главной', () => {
  const lowDays = ['26', '25', '24', '23', '22'].map(d => ({
    date: `2026-10-${d}`,
    ratings: { attachment: 3, autonomy: 3, expression: 3, play: 3, limits: 3 },
  }));

  it('строка «Задания» открывает узел заданий, его закрытие возвращает список', async () => {
    setup();
    fireEvent.click(row('Задания'));
    expect(await screen.findByTestId('tasks-hub')).toBeTruthy();
    fireEvent.click(screen.getByText('закрыть задания'));
    await waitFor(() => expect(screen.queryByTestId('tasks-hub')).toBeNull());
    expect(row('Задания')).toBeTruthy();
  });

  it('внизу тихая строка «самопомощь, не замена терапии» со ссылкой «Поговорить →»; без сигнала карточки нет', async () => {
    setup();
    const line = await screen.findByText(/Приложение — самопомощь, не замена терапии/);
    expect(line.textContent).toContain('Если нужна терапия, есть с кем поговорить.');
    expect(screen.getByRole('button', { name: 'Поговорить →' })).toBeTruthy();
    expect(screen.queryByText('Не сейчас')).toBeNull();
  });

  it('сигнал по трём низким дням: карточка стоит над списком, «Не сейчас» прячет', async () => {
    mockApi.history.mockResolvedValue(lowDays);
    setup();
    const eyebrow = await screen.findByText('Три последних заполненных дня: индекс не выше 4');
    const list = document.querySelector('.ds-card--flush')!;
    expect(eyebrow.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Не сейчас' }));
    expect(screen.queryByText('Три последних заполненных дня: индекс не выше 4')).toBeNull();
  });

  it('записи режимов из дневника доходят до сигнала: три раза один режим', async () => {
    const daysAgoIso = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
    mockApi.history.mockResolvedValue([6, 5, 4, 3, 2].map(i => ({ date: `2026-10-0${i}`, ratings: { attachment: 7, autonomy: 7, expression: 7, play: 7, limits: 7 } })));
    mockApi.getModeDiary.mockResolvedValue([1, 2, 3].map(i => ({ id: i, modeId: 'punitive_critic', situation: 'x', createdAt: daysAgoIso(i) })));
    setup();
    expect(await screen.findByText(/3 раза за две недели/)).toBeTruthy();
  });
});
