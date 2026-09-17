// @vitest-environment jsdom
// Точка монтирования карты себя: скелетон по форме, пока данные не готовы
// (правило CLAUDE.md — силуэт, не спиннер), и завязка на useHistorySheet
// (fixed-оверлей обязан использовать хук, иначе «Назад» браузера уводит из
// приложения).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SelfMapOverlay } from './SelfMapOverlay';

vi.mock('../../api', () => ({
  api: {
    getModeDiary: vi.fn().mockReturnValue(new Promise(() => {})),
    getModeNotes: vi.fn().mockResolvedValue([]),
    getProfile: vi.fn().mockResolvedValue({ ysq: { completedAt: null } }),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderOverlay(over = {}) {
  const props = {
    onClose: vi.fn(),
    onStartCase: vi.fn(),
    onOpenTracker: vi.fn(),
    onOpenSchema: vi.fn(),
    ...over,
  };
  render(
    <MemoryRouter>
      <SelfMapOverlay {...props} />
    </MemoryRouter>,
  );
  return props;
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('SelfMapOverlay', () => {
  it('падает без MemoryRouter — завязан на useHistorySheet', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <SelfMapOverlay
          onClose={vi.fn()}
          onStartCase={vi.fn()}
          onOpenTracker={vi.fn()}
          onOpenSchema={vi.fn()}
        />,
      ),
    ).toThrow();
    spy.mockRestore();
  });

  it('пока данные не готовы — скелетон, а не пустая карта и не спиннер-текст', () => {
    renderOverlay();
    expect(screen.getAllByText('Карта себя').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Черновик/)).toBeNull();
  });

  it('когда данные готовы — показывает саму карту', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    renderOverlay();
    await waitFor(() => expect(screen.getByText(/Черновик/)).toBeTruthy());
  });
});

/** Дни считаем от «сейчас», а не от литеральной даты — тест не протухает. */
const isoDaysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

describe('SelfMapOverlay — маршрутизация «что дальше»', () => {
  it('на пустой карте кнопка «что дальше» закрывает карту и открывает разбор', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    const onStartCase = vi.fn();
    renderOverlay({ onStartCase });
    await waitFor(() => expect(screen.getByText(/Разобрать случай/)).toBeTruthy());

    fireEvent.click(screen.getByText(/Разобрать случай/));
    expect(onStartCase).toHaveBeenCalledTimes(1);
  });

  it('накопленный триггер без пройденного теста на схемы ведёт на тест', async () => {
    // caseCount>=5, один режим виден в пяти разборах (repeatedTrigger),
    // карточка уже собрана (иначе «собрать приметы» сработало бы раньше),
    // есть ответ Здорового Взрослого (иначе сработало бы «попробуй ответить»).
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
    const onOpenSchema = vi.fn();
    renderOverlay({ onOpenSchema });
    await waitFor(() => expect(screen.getByText(/Пройти тест на схемы/)).toBeTruthy());

    fireEvent.click(screen.getByText(/Пройти тест на схемы/));
    expect(onOpenSchema).toHaveBeenCalledWith({ startTest: true });
  });
});
