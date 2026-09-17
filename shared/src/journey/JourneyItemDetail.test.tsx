// @vitest-environment jsdom
// Детальный просмотр записи «Моего пути»: useJourneyDetail — состояние
// open/close с подтяжкой полного контента, JourneyItemDetail — сама
// раскладка (скелетон при загрузке, пусто без текста, части с/без заголовка).
// useJourneyDetail — прямой пример read-after-write (правило CLAUDE.md):
// open() пишет item в состояние и запускает fetch, а компонент читает parts
// только после того, как загрузка закончилась — тест ловит рассинхрон, если
// кто-то покажет части ДО того, как fetch реально отработал.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  renderHook,
  act,
  waitFor,
} from '@testing-library/react';
import { useJourneyDetail, JourneyItemDetail } from './JourneyItemDetail';
import type { JourneyItem } from './journeyMeta';
import type { JourneyResultPart } from './journeyContent';

afterEach(() => {
  cleanup();
});

const ITEM: JourneyItem = {
  type: 'gratitude',
  at: '2026-07-21T10:00:00Z',
  id: 1,
};

describe('useJourneyDetail', () => {
  it('открытие: сразу item+loading, части появляются только после resolve fetch', async () => {
    let resolveFetch: (v: JourneyResultPart[]) => void;
    const fetchDetail = vi.fn(
      () =>
        new Promise<JourneyResultPart[]>((res) => {
          resolveFetch = res;
        }),
    );
    const { result } = renderHook(() => useJourneyDetail(fetchDetail));

    act(() => result.current.open(ITEM));
    expect(result.current.item).toBe(ITEM);
    expect(result.current.loading).toBe(true);
    expect(result.current.parts).toEqual([]); // ещё не пришло — не выдумываем данные

    await act(async () => {
      resolveFetch!([{ title: 'Что было', text: 'Утреннему кофе' }]);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.parts).toEqual([
      { title: 'Что было', text: 'Утреннему кофе' },
    ]);
  });

  it('ошибка fetch — части остаются пустым списком, не падает', async () => {
    const fetchDetail = vi.fn().mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useJourneyDetail(fetchDetail));
    await act(async () => {
      result.current.open(ITEM);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.parts).toEqual([]);
  });

  it('close сбрасывает item/parts/loading', async () => {
    const fetchDetail = vi.fn().mockResolvedValue([{ text: 'X' }]);
    const { result } = renderHook(() => useJourneyDetail(fetchDetail));
    await act(async () => {
      result.current.open(ITEM);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.close());
    expect(result.current.item).toBeNull();
    expect(result.current.parts).toEqual([]);
  });
});

describe('JourneyItemDetail', () => {
  it('item=null — ничего не рендерит', () => {
    const { container } = render(
      <JourneyItemDetail
        detail={{
          item: null,
          parts: [],
          loading: false,
          open: vi.fn(),
          close: vi.fn(),
        }}
        subtitle={() => null}
        onShare={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('loading=true — скелетон вместо текста (форма контента, а не спиннер)', () => {
    const { container } = render(
      <JourneyItemDetail
        detail={{
          item: ITEM,
          parts: [],
          loading: true,
          open: vi.fn(),
          close: vi.fn(),
        }}
        subtitle={() => null}
        onShare={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(
        'Здесь без записанного текста — только сам факт этого шага.',
      ),
    ).toBeNull();
    expect(container.querySelectorAll('div').length).toBeGreaterThan(1);
  });

  it('без частей — поясняющий текст «только сам факт этого шага»', () => {
    render(
      <JourneyItemDetail
        detail={{
          item: ITEM,
          parts: [],
          loading: false,
          open: vi.fn(),
          close: vi.fn(),
        }}
        subtitle={() => null}
        onShare={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        'Здесь без записанного текста — только сам факт этого шага.',
      ),
    ).toBeTruthy();
  });

  it('с частями — рендерит текст, «Назад» зовёт close, кнопка — onShare', () => {
    const close = vi.fn();
    const onShare = vi.fn();
    render(
      <JourneyItemDetail
        detail={{
          item: ITEM,
          parts: [{ title: 'Что было', text: 'Утреннему кофе' }],
          loading: false,
          open: vi.fn(),
          close,
        }}
        subtitle={() => null}
        onShare={onShare}
      />,
    );
    expect(screen.getByText('Утреннему кофе')).toBeTruthy();
    fireEvent.click(screen.getByText('← Назад'));
    expect(close).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Поделиться карточкой'));
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
