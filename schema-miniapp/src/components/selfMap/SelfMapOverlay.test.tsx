// @vitest-environment jsdom
// Точка монтирования карты себя: скелетон по форме, пока данные не готовы
// (правило CLAUDE.md — силуэт, не пустая карта), и маршрутизация «что
// дальше» — тест схем ведёт в свой раздел, всё остальное возвращает в разбор
// (он и есть основная работа). До этого теста ни useSelfMapData, ни сам
// оверлей не запускались ни одним тестом.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { SelfMapOverlay } from './SelfMapOverlay';

vi.mock('../../api', () => ({
  api: {
    getModeDiary: vi.fn(),
    getModeNotes: vi.fn(),
    getProfile: vi.fn(),
  },
}));
vi.mock('../../haptic', () => ({ haptic: { tap: vi.fn(), select: vi.fn() } }));

import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

/** Дни считаем от «сейчас», а не от литеральной даты — тест не протухает. */
const isoDaysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

function makeSheets() {
  return { selfMap: true, close: vi.fn(), open: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getModeNotes.mockResolvedValue([]);
  mockApi.getProfile.mockResolvedValue({ ysq: { completedAt: null } });
});
afterEach(cleanup);

describe('SelfMapOverlay — загрузка', () => {
  it('пока данные не готовы — скелетон, а не пустая карта', () => {
    mockApi.getModeDiary.mockReturnValue(new Promise(() => {}));
    render(<SelfMapOverlay sheets={makeSheets()} />);
    expect(screen.queryByText(/Черновик/)).toBeNull();
  });

  it('когда данные готовы — сама карта, без нулей и процентов', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    render(<SelfMapOverlay sheets={makeSheets()} />);
    await waitFor(() => expect(screen.getByText(/Черновик/)).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/0 случаев|0%|NaN/);
  });
});

describe('SelfMapOverlay — маршрутизация «что дальше»', () => {
  it('на пустой карте «Разобрать случай» закрывает карту и открывает разбор', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    const sheets = makeSheets();
    render(<SelfMapOverlay sheets={sheets} />);
    await waitFor(() =>
      expect(screen.getByText(/Разобрать случай/)).toBeTruthy(),
    );

    fireEvent.click(screen.getByText(/Разобрать случай/));
    expect(sheets.close).toHaveBeenCalledWith('selfMap');
    expect(sheets.open).toHaveBeenCalledWith('caseFlow');
  });

  it('накопленный триггер без пройденного теста на схемы предлагает тест — ведёт на него', async () => {
    // caseCount>=5, один и тот же режим виден в трёх+ разборах (repeatedTrigger),
    // карточка уже собрана (иначе сработало бы «собрать приметы»), режим не
    // копинг (иначе сработало бы «кто стоит за» раньше), есть хотя бы один
    // ответ Здорового Взрослого (иначе сработало бы «попробуй ответить»).
    mockApi.getModeDiary.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        modeId: 'vulnerable_child',
        createdAt: isoDaysAgo(5 - i),
        healthyResponse: i === 0 ? 'спокойно объяснила, что вымотана' : null,
      })),
    );
    mockApi.getModeNotes.mockResolvedValue([
      { modeId: 'vulnerable_child', alias: 'Ёжик', triggers: 'звонок мамы' },
    ]);
    const sheets = makeSheets();
    render(<SelfMapOverlay sheets={sheets} />);
    await waitFor(() =>
      expect(screen.getByText(/Пройти тест на схемы/)).toBeTruthy(),
    );

    fireEvent.click(screen.getByText(/Пройти тест на схемы/));
    expect(sheets.close).toHaveBeenCalledWith('selfMap');
    expect(sheets.open).toHaveBeenCalledWith('schemaInfo');
  });
});

describe('SelfMapOverlay — тап по режиму', () => {
  it('закрывает карту (в отличие от «что дальше», onPickMode не открывает разбор)', async () => {
    mockApi.getModeDiary.mockResolvedValue([
      { modeId: 'detached_protector', createdAt: isoDaysAgo(1) },
    ]);
    mockApi.getModeNotes.mockResolvedValue([
      { modeId: 'detached_protector', alias: 'Стена', triggers: 'триггер' },
    ]);
    const sheets = makeSheets();
    render(<SelfMapOverlay sheets={sheets} />);
    await waitFor(() => expect(screen.getByText('Стена')).toBeTruthy());

    fireEvent.click(screen.getByText('Стена'));
    expect(sheets.close).toHaveBeenCalledWith('selfMap');
    expect(sheets.open).not.toHaveBeenCalled();
  });
});
