// @vitest-environment jsdom
// HistoryView — главный экран истории трекера. До этого теста 0% покрытия
// (135 непокрытых строк), хотя экран показывает пользователю его реальные
// оценки за прошлые дни — ошибка тут читается как «мои данные пропали».
// Проверяем: пустое состояние (без хардкод-заглушек — реальный пустой
// массив истории показывает объяснение пустой истории, а не выдуманные цифры), рендер дня и
// недели из РЕАЛЬНЫХ props (не констант), переключение вкладок, открытие
// дочерних листов (NeedHistorySheet/IndexInfoSheet/WeeklyCardSheet/NoteSheet),
// ты/вы-вилку в пустом состоянии, инсайт про «стабильно низкую» потребность.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { HistoryView } from './HistoryView';
import type { Need, DayHistory } from '../types';

vi.mock('../api', () => ({
  api: {
    getNote: vi.fn(),
    saveNote: vi.fn(),
    trackEvent: vi.fn(),
    getStreak: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

// canvas 2d-контекст не реализован в jsdom (см. ModeEntryShare.test.tsx) —
// нужен для «Карточки недели» (WeeklyCardSheet рисует canvas).
function mockCtx() {
  return {
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    stroke: vi.fn(), fill: vi.fn(), closePath: vi.fn(), arc: vi.fn(), fillRect: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(() => ({ width: 0 })), clearRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    roundRect: vi.fn(), clip: vi.fn(), translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
    drawImage: vi.fn(), setLineDash: vi.fn(),
    globalAlpha: 1, textAlign: 'left' as CanvasTextAlign,
  };
}
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
  mockCtx() as unknown as RenderingContext,
);
// jsdom не реализует scrollIntoView (используется для прокрутки date-strip
// к выбранному дню) — без мока эффект роняет рендер.
HTMLElement.prototype.scrollIntoView = vi.fn();

const NEEDS: Need[] = [
  { id: 'attachment', emoji: '🤝', title: 'Привязанность', chartLabel: 'Привяз.' },
  { id: 'autonomy',   emoji: '🧭', title: 'Автономия',    chartLabel: 'Автон.' },
];

function day(date: string, ratings: Record<string, number>): DayHistory {
  return { date, ratings };
}

function renderView(props: Partial<Parameters<typeof HistoryView>[0]> = {}, form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter>
        <HistoryView needs={NEEDS} history={[]} currentRatings={{}} {...props} />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getNote.mockResolvedValue({ text: null, tags: [] });
  mockApi.getStreak.mockResolvedValue({ currentStreak: 0 });
  localStorage.clear();
});

afterEach(() => cleanup());

describe('HistoryView — пустое состояние', () => {
  it('на чистом аккаунте (history=[]) показывает объяснение пустой истории, а не выдуманные цифры', () => {
    renderView({ history: [] });
    expect(screen.getByText(/трекер сегодня/)).toBeTruthy();
    // Реальных данных нет — никаких чисел/оценок на экране не должно быть.
    expect(screen.queryByText(/индекс/)).toBeNull();
  });

  it('пустое состояние звучит в форме «вы»', () => {
    renderView({ history: [] }, 'vy');
    expect(screen.getByText(/Заполните трекер сегодня/)).toBeTruthy();
  });

  it('пустое состояние звучит в форме «ты»', () => {
    renderView({ history: [] }, 'ty');
    expect(screen.getByText(/Заполни трекер сегодня/)).toBeTruthy();
  });

  it('кнопка «Заполнить сегодня» зовёт onGoToToday', () => {
    const onGoToToday = vi.fn();
    renderView({ history: [], onGoToToday });
    fireEvent.click(screen.getByText('Заполнить сегодня'));
    expect(onGoToToday).toHaveBeenCalledTimes(1);
  });
});

describe('HistoryView — день с реальными данными', () => {
  // Даты заведомо в прошлом (не сегодня по системным часам тестового
  // раннера) — иначе HistoryView подставляет currentRatings вместо
  // ratings дня и бэкфилл-строка не рендерится (backfill скрыт для «сегодня»).
  const HISTORY: DayHistory[] = [
    day('2020-01-03', { attachment: 8, autonomy: 7 }),
    day('2020-01-02', { attachment: 3, autonomy: 3 }),
    day('2020-01-01', { attachment: 2, autonomy: 2 }),
  ];

  it('рисует индекс дня из РЕАЛЬНЫХ ratings, а не из константы', async () => {
    await act(async () => {
      renderView({ history: HISTORY, currentRatings: { attachment: 8, autonomy: 7 } });
    });
    // avg(8,7) = 7,5 — если бы использовался хардкод-фолбэк, число было бы другим.
    // Запятая — общий fmtIndex (QA 2026-11, B-М3), как на плитке «Сегодня».
    expect(screen.getByText('7,5')).toBeTruthy();
  });

  it('клик по потребности в списке открывает NeedHistorySheet', async () => {
    await act(async () => {
      renderView({ history: HISTORY, currentRatings: { attachment: 8, autonomy: 7 } });
    });
    fireEvent.click(screen.getByText('Привяз.'));
    expect(screen.getByText('Динамика')).toBeTruthy();
  });

  it('клик по центру индекса открывает IndexInfoSheet', async () => {
    const { container } = render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter>
          <HistoryView needs={NEEDS} history={HISTORY} currentRatings={{}} />
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );
    await act(async () => {});
    // Кликабельный круг-хитбокс центра — прозрачный, поверх текста «индекс»
    // (клик по самому <text> не всплывёт до соседнего <circle>). Круг с
    // r=41 встречается дважды (фон + прозрачный хитбокс) — нужен именно
    // прозрачный, последний в разметке.
    const centerHit = container.querySelector('circle[r="41"][fill="transparent"]');
    expect(centerHit).toBeTruthy();
    fireEvent.click(centerHit!);
    expect(screen.getByText('Об индексе')).toBeTruthy();
  });

  it('клик по строке заметки открывает NoteSheet, подгружающий её через api.getNote', async () => {
    await act(async () => {
      renderView({ history: HISTORY, currentRatings: { attachment: 8, autonomy: 7 } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Добавить заметку к этому дню'));
    });
    // Второй вызов — уже внутри NoteSheet при его собственном монтировании.
    expect(mockApi.getNote).toHaveBeenCalledTimes(2);
  });

  it('переключение дня в date-strip меняет заметку под выбранный день (read-after-write связка)', async () => {
    mockApi.getNote.mockResolvedValueOnce({ text: null, tags: [] });
    await act(async () => {
      renderView({ history: HISTORY, currentRatings: { attachment: 8, autonomy: 7 } });
    });
    mockApi.getNote.mockResolvedValueOnce({ text: 'Заметка второго дня', tags: [] });
    await act(async () => {
      fireEvent.click(screen.getByText('2'));
    });
    expect(screen.getByText('Заметка второго дня')).toBeTruthy();
  });

  // Аудит 2026-11, E8: ответ без флага `alive` и без сброса — под выбранным днём
  // оставалась заметка другого дня, а отказ запроса уходил необработанным.
  it('поздний ответ прошлого дня не подменяет заметку выбранного', async () => {
    let first!: (v: unknown) => void;
    let second!: (v: unknown) => void;
    mockApi.getNote
      .mockReturnValueOnce(new Promise((r) => { first = r; }))
      .mockReturnValueOnce(new Promise((r) => { second = r; }));
    await act(async () => { renderView({ history: HISTORY, currentRatings: {} }); });
    await act(async () => { fireEvent.click(screen.getByText('2')); });
    await act(async () => { second({ text: 'Заметка второго дня', tags: [] }); });
    await act(async () => { first({ text: 'Заметка третьего дня', tags: ['work'] }); });
    expect(screen.getByText('Заметка второго дня')).toBeTruthy();
    expect(screen.queryByText('Заметка третьего дня')).toBeNull();
    expect(screen.queryByText('work')).toBeNull();
  });

  it('смена дня сразу убирает заметку прежнего, пока новая не пришла', async () => {
    mockApi.getNote.mockResolvedValueOnce({ text: 'Заметка третьего дня', tags: [] });
    await act(async () => { renderView({ history: HISTORY, currentRatings: {} }); });
    expect(screen.getByText('Заметка третьего дня')).toBeTruthy();
    mockApi.getNote.mockReturnValueOnce(new Promise(() => {}));
    await act(async () => { fireEvent.click(screen.getByText('2')); });
    expect(screen.queryByText('Заметка третьего дня')).toBeNull();
    expect(screen.getByText('Добавить заметку к этому дню')).toBeTruthy();
  });

  it('отказ запроса заметки не роняет экран и не показывает чужое', async () => {
    mockApi.getNote.mockRejectedValue(new Error('network down'));
    await act(async () => { renderView({ history: HISTORY, currentRatings: {} }); });
    expect(screen.getByText('7,5')).toBeTruthy();
    expect(screen.getByText('Добавить заметку к этому дню')).toBeTruthy();
  });

  it('после закрытия листа заметки строка дня перечитывается', async () => {
    await act(async () => { renderView({ history: HISTORY, currentRatings: {} }); });
    await act(async () => { fireEvent.click(screen.getByText('Добавить заметку к этому дню')); });
    mockApi.getNote.mockResolvedValueOnce({ text: 'Только что записано', tags: [] });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Назад' })); });
    expect(screen.getByText('Только что записано')).toBeTruthy();
  });

  it('бэкфилл прошлого дня зовёт onBackfill с датой этого дня', async () => {
    const onBackfill = vi.fn();
    await act(async () => {
      renderView({ history: HISTORY, currentRatings: { attachment: 8, autonomy: 7 }, onBackfill });
    });
    fireEvent.click(screen.getByText(/Дополнить оценки|Заполнить этот день/));
    expect(onBackfill).toHaveBeenCalledWith('2020-01-03');
  });

  it('потребность, низкая 3+ дня подряд, показывает инсайт «Стоит уделить внимание»', async () => {
    const lowHistory: DayHistory[] = [
      day('2020-01-03', { attachment: 2, autonomy: 8 }),
      day('2020-01-02', { attachment: 3, autonomy: 8 }),
      day('2020-01-01', { attachment: 1, autonomy: 8 }),
    ];
    await act(async () => {
      renderView({ history: lowHistory, currentRatings: { attachment: 2, autonomy: 8 } });
    });
    expect(screen.getByText('Стоит уделить внимание')).toBeTruthy();
    expect(screen.getByText(/Остаётся низкой несколько дней подряд/)).toBeTruthy();
    // CTA текст общий с miniapp (Ж9 аудита 2026-08) — раньше здесь было «Записаться →».
    expect(screen.getByText('Записаться и взять сводку →')).toBeTruthy();
  });

  it('0 — «не оценено», а не низкая оценка: инсайта нет', async () => {
    const zeroHistory: DayHistory[] = [
      day('2020-01-03', { attachment: 0, autonomy: 8 }),
      day('2020-01-02', { attachment: 0, autonomy: 8 }),
      day('2020-01-01', { attachment: 0, autonomy: 8 }),
    ];
    await act(async () => { renderView({ history: zeroHistory, currentRatings: {} }); });
    expect(screen.queryByText('Стоит уделить внимание')).toBeNull();
  });

  it('подсказка над трекером звучит в форме «ты» (текст общий с miniapp, Ж9)', async () => {
    await act(async () => {
      renderView({ history: HISTORY, currentRatings: { attachment: 8, autonomy: 7 } }, 'ty');
    });
    expect(screen.getByText('Нажми на потребность — узнаешь, что делать')).toBeTruthy();
  });

  it('подсказка над трекером звучит в форме «вы» (текст общий с miniapp, Ж9)', async () => {
    await act(async () => {
      renderView({ history: HISTORY, currentRatings: { attachment: 8, autonomy: 7 } }, 'vy');
    });
    expect(screen.getByText('Нажмите на потребность — узнаете, что делать')).toBeTruthy();
  });
});

describe('HistoryView — вкладка «Неделя»', () => {
  const HISTORY: DayHistory[] = [
    day('2026-08-03', { attachment: 8, autonomy: 7 }),
    day('2026-08-02', { attachment: 5, autonomy: 5 }),
  ];

  it('переключение на «Неделя» рисует спарклайны по потребностям', async () => {
    await act(async () => {
      renderView({ history: HISTORY, currentRatings: { attachment: 8, autonomy: 7 }, days: 7 });
    });
    fireEvent.click(screen.getByText('Неделя'));
    expect(screen.getByText('Привяз.')).toBeTruthy();
    expect(screen.getByText('За 7 дней')).toBeTruthy();
  });

  it('кнопка «Карточка недели» открывает WeeklyCardSheet', async () => {
    await act(async () => {
      renderView({ history: HISTORY, currentRatings: { attachment: 8, autonomy: 7 } });
    });
    fireEvent.click(screen.getByText('Неделя'));
    await act(async () => {
      fireEvent.click(screen.getByText('Карточка недели →'));
    });
    expect(screen.getByText(/Карточка недели/)).toBeTruthy();
  });
});
