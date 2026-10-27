// @vitest-environment jsdom
// Компонентные тесты TrackerOverlay (webapp, «один вопрос на экран»): вопрос,
// ответ словами, автопереход, «Пропустить», экран «Готово», бэкфилл, сохранение
// (debounce автосейва), ошибка API. Образец сетапа: мок '../api', vi.useFakeTimers.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TrackerOverlay } from './TrackerOverlay';
import { AUTO_ADVANCE_MS } from './trackerOverlay/trackerFlow';
import { TRACKER_ONBOARDING_KEY, TRACKER_ORIGIN_NOTE } from '../../../shared/src/needs/trackerOnboarding';
import type { Need } from '../types';

// useHistorySheet (внутри TrackerOverlay) требует react-router-контекст.
vi.mock('../api', () => ({
  api: { ratings: vi.fn(), saveRating: vi.fn(), trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockReportClientError = reportClientError as ReturnType<typeof vi.fn>;

const NEEDS: Need[] = [
  { id: 'attachment', emoji: '🤝', title: 'Привязанность', chartLabel: 'Привяз.' },
  { id: 'autonomy', emoji: '🧭', title: 'Автономия', chartLabel: 'Автон.' },
];

type Over = Record<string, unknown>;

// Родитель держит оценки, как AppShell: ответ меняет ratings, автопереход смотрит на них.
function Harness({ initial = {}, ...rest }: { initial?: Record<string, number> } & Over) {
  const [ratings, setRatings] = useState(initial);
  return (
    <TrackerOverlay
      needs={NEEDS}
      ratings={ratings}
      onChange={(id: string, v: number) => setRatings((r) => ({ ...r, [id]: v }))}
      onSaved={vi.fn()}
      onClose={vi.fn()}
      {...rest}
    />
  );
}

function renderOverlay(props: Over = {}) {
  return render(
    <MemoryRouter>
      <Harness {...props} />
    </MemoryRouter>,
  );
}

const answer = (label: RegExp | string) => fireEvent.click(screen.getByRole('button', { name: label }));
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const heading = (name: string) => screen.getByRole('heading', { level: 1, name });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  localStorage.clear();
  mockApi.saveRating.mockResolvedValue({ ok: true, allDone: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TrackerOverlay — вопрос', () => {
  it('показывает номер, название, вопрос про сегодня и пять ответов словами', () => {
    renderOverlay();
    expect(screen.getByText('Потребность 1 из 2')).toBeTruthy();
    expect(heading('Привязанность')).toBeTruthy();
    expect(screen.getByText(/Были ли сегодня конкретные моменты близости/)).toBeTruthy();
    expect(screen.getByText('Выбор сохраняется сразу и сам открывает следующий вопрос.')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Привязанность' }).querySelectorAll('button')).toHaveLength(5);
  });

  it('открывает нужную потребность по initialNeedId, а не первую в списке', () => {
    renderOverlay({ initialNeedId: 'autonomy' });
    expect(heading('Автономия')).toBeTruthy();
  });

  it('открывается на первой неоценённой', () => {
    renderOverlay({ initial: { attachment: 6 } });
    expect(heading('Автономия')).toBeTruthy();
  });

  it('тап по точке прогресса переключает потребность', () => {
    renderOverlay();
    fireEvent.click(screen.getByRole('button', { name: 'Автономия' }));
    expect(heading('Автономия')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Привязанность' }));
    expect(heading('Привязанность')).toBeTruthy();
  });

  it('тап по названию-ссылке «Что считается…» открывает лист потребности', () => {
    renderOverlay();
    fireEvent.click(screen.getByText('Что считается и как понять оценку'));
    expect(screen.getByText('Назад к дневнику')).toBeTruthy();
  });

  it('свайп влево переключает на следующую потребность, вправо — назад', () => {
    const { container } = renderOverlay();
    const root = container.firstElementChild as HTMLElement;
    fireEvent.touchStart(root, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 100, clientY: 100 }] });
    expect(heading('Автономия')).toBeTruthy();
    fireEvent.touchStart(root, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 300, clientY: 100 }] });
    expect(heading('Привязанность')).toBeTruthy();
  });

  it('вертикальный жест не листает', () => {
    const { container } = renderOverlay();
    const root = container.firstElementChild as HTMLElement;
    fireEvent.touchStart(root, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 150, clientY: 400 }] });
    expect(heading('Привязанность')).toBeTruthy();
  });
});

describe('TrackerOverlay — ответ и автопереход', () => {
  it('ответ сразу пробрасывается наверх (onChange) значением слова', () => {
    const onChange = vi.fn();
    renderOverlay({ onChange });
    answer(/В основном да/);
    expect(onChange).toHaveBeenCalledWith('attachment', 8);
  });

  it('следующий вопрос открывается через ~250 мс, а не мгновенно', async () => {
    renderOverlay();
    answer(/В основном да/);
    expect(heading('Привязанность')).toBeTruthy();
    await advance(AUTO_ADVANCE_MS - 10);
    expect(heading('Привязанность')).toBeTruthy();
    await advance(20);
    expect(heading('Автономия')).toBeTruthy();
  });

  it('последний ответ ведёт на «Готово» с индексом и наблюдением про самое низкое', async () => {
    renderOverlay();
    answer(/В основном да/);
    await advance(AUTO_ADVANCE_MS);
    answer(/Мало/);
    await advance(AUTO_ADVANCE_MS);
    expect(screen.getByText('Трекер · сегодня')).toBeTruthy();
    expect(screen.getByText('6,0')).toBeTruthy();
    expect(screen.getByText('Ниже всего — автономия. Не вывод, а точка: посмотрим, повторится ли.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Поправить ответы' })).toBeTruthy();
  });

  it('ответ на более раннюю потребность возвращает к пропущенной, а не завершает', async () => {
    renderOverlay({ initialNeedId: 'autonomy' });
    answer(/Полностью/);
    await advance(AUTO_ADVANCE_MS);
    expect(heading('Привязанность')).toBeTruthy();
  });

  it('новый ответ внутри окна автоперехода не плодит переходы', async () => {
    renderOverlay();
    answer(/Мало/);
    await advance(100);
    answer(/В основном да/);
    await advance(AUTO_ADVANCE_MS);
    expect(heading('Автономия')).toBeTruthy();
    await advance(1000);
    expect(heading('Автономия')).toBeTruthy();
  });

  it('точка во время ожидания отменяет автопереход', async () => {
    renderOverlay();
    answer(/Мало/);
    fireEvent.click(screen.getByRole('button', { name: 'Автономия' }));
    fireEvent.click(screen.getByRole('button', { name: 'Привязанность' }));
    await advance(AUTO_ADVANCE_MS * 2);
    expect(heading('Привязанность')).toBeTruthy();
  });
});

describe('TrackerOverlay — «Пропустить»', () => {
  it('идёт к следующей неоценённой без сохранения и шлёт tracker_skip', async () => {
    renderOverlay();
    fireEvent.click(screen.getByRole('button', { name: 'Пропустить' }));
    expect(heading('Автономия')).toBeTruthy();
    expect(mockApi.trackEvent).toHaveBeenCalledWith('tracker_skip');
    await advance(1000);
    expect(mockApi.saveRating).not.toHaveBeenCalled();
  });

  it('на последней ведёт на «Готово» с «Заполнено N из 5» и «Дооценить»', () => {
    renderOverlay({ initial: { attachment: 6 } });
    fireEvent.click(screen.getByRole('button', { name: 'Пропустить' }));
    expect(screen.getByText(/Остальное можно дооценить позже/)).toBeTruthy();
    expect(screen.queryByText(/Ниже всего/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Дооценить' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Поправить ответы' })).toBeNull();
    expect(screen.getByText('1 из 2')).toBeTruthy();
    expect(screen.getByText('заполнено')).toBeTruthy();
    expect(screen.queryByText('индекс дня из 10')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('«Дооценить» открывает первую пустую потребность', () => {
    renderOverlay({ initial: { autonomy: 6 } });
    fireEvent.click(screen.getByRole('button', { name: 'Пропустить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Дооценить' }));
    expect(heading('Привязанность')).toBeTruthy();
  });
});

describe('TrackerOverlay — экран «Готово»', () => {
  it('всё оценено при открытии — сразу «Готово»; «Поправить ответы» ведёт к первому вопросу', () => {
    renderOverlay({ initial: { attachment: 4, autonomy: 8 } });
    expect(screen.getByText('Трекер · сегодня')).toBeTruthy();
    expect(screen.getByText('Ниже всего — привязанность. Не вывод, а точка: посмотрим, повторится ли.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Поправить ответы' }));
    expect(heading('Привязанность')).toBeTruthy();
  });

  it('с initialNeedId не перескакивает на «Готово»', () => {
    renderOverlay({ initial: { attachment: 4, autonomy: 8 }, initialNeedId: 'autonomy' });
    expect(heading('Автономия')).toBeTruthy();
  });

  it('столбики по потребностям подписаны словом оценки', () => {
    renderOverlay({ initial: { attachment: 4, autonomy: 8 } });
    expect(screen.getByLabelText('Привязанность: Мало')).toBeTruthy();
    expect(screen.getByLabelText('Автономия: В основном да')).toBeTruthy();
  });

  it('«На главную» закрывает трекер', () => {
    const onClose = vi.fn();
    renderOverlay({ initial: { attachment: 4, autonomy: 8 }, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'На главную' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('«История →» открывает историю и закрывает трекер; без onOpenHistory ссылки нет', () => {
    const onOpenHistory = vi.fn();
    const onClose = vi.fn();
    renderOverlay({ initial: { attachment: 4, autonomy: 8 }, onOpenHistory, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'История →' }));
    expect(onOpenHistory).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanup();
    renderOverlay({ initial: { attachment: 4, autonomy: 8 } });
    expect(screen.queryByRole('button', { name: 'История →' })).toBeNull();
  });

  it('«Заметка» зовёт onOpenNote; рядом кнопка «Поделиться днём»', () => {
    const onOpenNote = vi.fn();
    renderOverlay({ initial: { attachment: 4, autonomy: 8 }, onOpenNote });
    fireEvent.click(screen.getByRole('button', { name: 'Заметка' }));
    expect(onOpenNote).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Поделиться днём')).toBeTruthy();
  });
});

describe('TrackerOverlay — строка «откуда это»', () => {
  it('первый раз (нет оценок, флага нет): строка над вопросом; «Понятно» закрывает и ставит флаг', () => {
    renderOverlay();
    expect(screen.getByText(TRACKER_ORIGIN_NOTE)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));
    expect(screen.queryByText(TRACKER_ORIGIN_NOTE)).toBeNull();
    expect(localStorage.getItem(TRACKER_ONBOARDING_KEY)).toBe('1');
  });

  it('строка не убегает из-под пальца при первом ответе и уходит вместе с первым вопросом', async () => {
    renderOverlay();
    answer(/Мало/);
    expect(screen.getByText(TRACKER_ORIGIN_NOTE)).toBeTruthy();
    await advance(AUTO_ADVANCE_MS);
    expect(screen.queryByText(TRACKER_ORIGIN_NOTE)).toBeNull();
  });

  it('уже есть оценки или флаг стоит — строки нет', () => {
    renderOverlay({ initial: { attachment: 6 } });
    expect(screen.queryByText(TRACKER_ORIGIN_NOTE)).toBeNull();
    cleanup();
    localStorage.setItem(TRACKER_ONBOARDING_KEY, '1');
    renderOverlay();
    expect(screen.queryByText(TRACKER_ORIGIN_NOTE)).toBeNull();
  });

  it('трёх шагов старого онбординга нет', () => {
    renderOverlay();
    expect(screen.queryByText('Далее →')).toBeNull();
    expect(screen.queryByText(/по дуге/)).toBeNull();
  });
});

describe('TrackerOverlay — сохранение оценки', () => {
  it('api.saveRating вызывается только после паузы 500мс (debounce)', () => {
    renderOverlay();
    answer(/В основном да/);
    expect(mockApi.saveRating).not.toHaveBeenCalled();
  });

  it('после debounce сохраняет через api и вызывает onSaved', async () => {
    mockApi.saveRating.mockResolvedValue({ ok: true, allDone: true, streak: { count: 3 } });
    const onSaved = vi.fn();
    renderOverlay({ onSaved });
    answer(/В основном да/);
    await advance(500);
    expect(mockApi.saveRating).toHaveBeenCalledWith('attachment', 8);
    expect(onSaved).toHaveBeenCalledWith('attachment', { count: 3 });
  });

  it('оценка последнего вопроса не теряется, если «На главную» нажали раньше debounce', async () => {
    renderOverlay({ initial: { attachment: 6 } });
    answer(/Полностью/);
    await advance(AUTO_ADVANCE_MS);
    expect(screen.getByText('Трекер · сегодня')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'На главную' }));
    cleanup();
    await advance(10);
    expect(mockApi.saveRating).toHaveBeenCalledWith('autonomy', 10);
  });

  it('офлайн: isOffline=true не вызывает api.saveRating после debounce', async () => {
    renderOverlay({ isOffline: true });
    answer(/В основном да/);
    await advance(500);
    expect(mockApi.saveRating).not.toHaveBeenCalled();
  });

  it('ошибка api.saveRating не роняет компонент, не вызывает onSaved и уходит отчётом наверх (section: tracker)', async () => {
    mockApi.saveRating.mockRejectedValue(new Error('network'));
    const onSaved = vi.fn();
    renderOverlay({ onSaved });
    answer(/В основном да/);
    await advance(500);
    expect(onSaved).not.toHaveBeenCalled();
    expect(heading('Автономия')).toBeTruthy();
    expect(mockReportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'tracker', message: expect.stringContaining('rating save failed') }),
    );
  });
});

// Только реальные вчерашние оценки (правило «Никаких хардкод-заглушек»): нет данных — нет пометки.
describe('«вчера» — только из реальных данных', () => {
  it('без вчерашних оценок пометки нет, даже когда сегодня оценка стоит', () => {
    renderOverlay({ initial: { attachment: 5 }, initialNeedId: 'attachment', yesterdayRatings: {} });
    expect(screen.queryByText(/вчера/i)).toBeNull();
  });

  it('с реальной вчерашней оценкой слово помечено «вчера»', () => {
    renderOverlay({ initial: { attachment: 5 }, initialNeedId: 'attachment', yesterdayRatings: { attachment: 3 } });
    const marked = screen.getAllByRole('button').filter((b) => b.textContent?.includes('вчера'));
    expect(marked.map((b) => b.getAttribute('aria-label'))).toEqual(['Мало — 4 из 10']);
  });
});

describe('TrackerOverlay — топбар', () => {
  it('«Закрыть» закрывает трекер', () => {
    const onClose = vi.fn();
    renderOverlay({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('TrackerOverlay — бэкафилл прошлой даты', () => {
  it('подгружает оценки через api.ratings и показывает скелетон вопроса до ответа', () => {
    mockApi.ratings.mockReturnValue(new Promise(() => {}));
    renderOverlay({ date: '2026-07-10' });
    const sk = screen.getByRole('status', { name: 'Загружаются оценки дня' });
    expect(sk.querySelectorAll('.skel').length).toBe(8);
    expect(screen.queryByText('Загрузка...')).toBeNull();
    expect(mockApi.ratings).toHaveBeenCalledWith('2026-07-10');
  });

  it('api.ratings отклонён: скелетон уходит, день пустой, отказ уходит отчётом наверх', async () => {
    mockApi.ratings.mockRejectedValue(new Error('network'));
    renderOverlay({ date: '2026-07-10' });
    await act(async () => {});
    expect(screen.queryByRole('status', { name: 'Загружаются оценки дня' })).toBeNull();
    expect(heading('Привязанность')).toBeTruthy();
    expect(mockReportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'tracker', message: expect.stringContaining('backfill ratings load failed') }),
    );
  });

  it('после загрузки показывает вопрос с датой и без вчерашних пометок и строки «откуда это»', async () => {
    mockApi.ratings.mockResolvedValue({ attachment: 4 });
    renderOverlay({ date: '2026-07-10', yesterdayRatings: { attachment: 3 } });
    await act(async () => {});
    expect(screen.queryByRole('status', { name: 'Загружаются оценки дня' })).toBeNull();
    expect(heading('Привязанность')).toBeTruthy();
    expect(screen.getByText(/10 июля/)).toBeTruthy();
    expect(screen.queryByText(/вчера/)).toBeNull();
    expect(screen.queryByText(TRACKER_ORIGIN_NOTE)).toBeNull();
  });

  it('ответ сохраняется с датой, автопереход и «Готово» работают так же, «Готово» зовёт onDone', async () => {
    mockApi.ratings.mockResolvedValue({});
    const onDone = vi.fn();
    renderOverlay({ date: '2026-07-10', onDone });
    await act(async () => {});
    answer(/Наполовину/);
    await advance(AUTO_ADVANCE_MS);
    expect(heading('Автономия')).toBeTruthy();
    answer(/Полностью/);
    await advance(AUTO_ADVANCE_MS);
    expect(mockApi.saveRating).toHaveBeenCalledWith('attachment', 6, '2026-07-10');
    expect(screen.getByText('Трекер · 10 июля')).toBeTruthy();
    expect(screen.getByText('8,0')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('ошибка сохранения бэкафилла не роняет экран и уходит отчётом наверх', async () => {
    mockApi.ratings.mockResolvedValue({});
    mockApi.saveRating.mockRejectedValue(new Error('network'));
    renderOverlay({ date: '2026-07-10' });
    await act(async () => {});
    answer(/Наполовину/);
    await advance(500);
    expect(heading('Автономия')).toBeTruthy();
    expect(mockReportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'tracker', message: expect.stringContaining('backfill rating save failed') }),
    );
  });
});
