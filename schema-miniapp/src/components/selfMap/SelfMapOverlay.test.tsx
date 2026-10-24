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
  return { selfMap: true, open: vi.fn() };
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
    render(<SelfMapOverlay sheets={makeSheets()} onClose={vi.fn()} />);
    expect(screen.queryByText(/Черновик/)).toBeNull();
  });

  it('когда данные готовы — сама карта, без нулей и процентов', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    render(<SelfMapOverlay sheets={makeSheets()} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Черновик/)).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/0 случаев|0%|NaN/);
  });
});

describe('SelfMapOverlay — маршрутизация «что дальше»', () => {
  it('на пустой карте «Разобрать случай» закрывает карту и открывает разбор', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    const sheets = makeSheets();
    const onClose = vi.fn();
    render(<SelfMapOverlay sheets={sheets} onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByText(/Разобрать случай/)).toBeTruthy(),
    );

    fireEvent.click(screen.getByText(/Разобрать случай/));
    expect(onClose).toHaveBeenCalledTimes(1);
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
    const onClose = vi.fn();
    render(<SelfMapOverlay sheets={sheets} onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByText(/Пройти тест на схемы/)).toBeTruthy(),
    );

    fireEvent.click(screen.getByText(/Пройти тест на схемы/));
    expect(onClose).toHaveBeenCalledTimes(1);
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
    const onClose = vi.fn();
    render(<SelfMapOverlay sheets={sheets} onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('Стена')).toBeTruthy());

    fireEvent.click(screen.getByText('Стена'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sheets.open).not.toHaveBeenCalled();
  });
});

// Закрытие листа определяет реестр (hooks/overlayClosers): крестик и «Назад»
// хоста обязаны звать ОДНУ функцию. Своё sheets.close('selfMap') внутри
// компонента снова развело бы два места закрытия (ревью PR #696).
describe('SelfMapOverlay — закрытие идёт через onClose из реестра', () => {
  it('в скелетоне ручка и подложка листа зовут onClose', () => {
    mockApi.getModeDiary.mockReturnValue(new Promise(() => {}));
    const sheets = { ...makeSheets(), close: vi.fn() };
    const onClose = vi.fn();
    render(<SelfMapOverlay sheets={sheets} onClose={onClose} />);

    const dismiss = screen.getAllByRole('button', { name: 'Закрыть' });
    dismiss.forEach((el) => fireEvent.click(el));
    expect(onClose).toHaveBeenCalledTimes(dismiss.length);
    expect(sheets.close).not.toHaveBeenCalled();
  });

  it('на готовой карте «Назад» в шапке зовёт onClose', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    const sheets = { ...makeSheets(), close: vi.fn() };
    const onClose = vi.fn();
    render(<SelfMapOverlay sheets={sheets} onClose={onClose} />);
    await waitFor(() => expect(screen.getByText(/Черновик/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sheets.close).not.toHaveBeenCalled();
  });
});
