// @vitest-environment jsdom
// «Тёплые слова» — свои же ответы Здорового Взрослого, собранные в одном
// месте, чтобы перечитывать в трудный момент.
//
// Ключевая проверка здесь — различие «пусто» и «не загрузилось». Раньше сбой
// запроса ловился как `.catch(() => setItems([]))`, и человек, у которого
// слова есть, при обрыве сети видел «Здесь пока пусто. Слова появятся,
// когда сохранишь…» — то есть приложение уверяло его, что он ничего не
// писал. Гейт тихих catch такое не ловит: в теле стрелки стоит вызов, а не
// пустой блок. Ловит только тест, который роняет запрос.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWarmWords, type WarmWordsDeps } from './useWarmWords';
import { WARM_WORDS_OPEN_EVENT } from '../share/analytics';

const deps = (over: Partial<WarmWordsDeps> = {}): WarmWordsDeps => ({
  getModeNotes: vi.fn().mockResolvedValue([]),
  getModeDiary: vi.fn().mockResolvedValue([]),
  getPhraseChecks: vi.fn().mockResolvedValue([]),
  trackEvent: vi.fn(),
  ...over,
});

describe('useWarmWords', () => {
  it('до ответа сервера — items null (экран рисует скелетон), провала нет', () => {
    const { result } = renderHook(() => useWarmWords(deps()));
    expect(result.current.items).toBeNull();
    expect(result.current.failed).toBe(false);
  });

  it('собирает слова из трёх источников и трекает открытие с их числом', async () => {
    const d = deps({
      getModeNotes: vi.fn().mockResolvedValue([
        {
          modeId: 'healthy_adult',
          healthyAdultReply: 'ты справишься',
          updatedAt: '2024-05-05',
        },
      ]),
      getPhraseChecks: vi.fn().mockResolvedValue([
        {
          id: 1,
          rewrite: 'я могу ошибаться',
          inWarmWords: true,
          createdAt: '2024-05-06',
        },
      ]),
    });
    const { result } = renderHook(() => useWarmWords(d));

    await waitFor(() => expect(result.current.items).not.toBeNull());
    expect(result.current.items!.length).toBeGreaterThan(0);
    expect(result.current.failed).toBe(false);
    expect(d.trackEvent).toHaveBeenCalledWith(WARM_WORDS_OPEN_EVENT, {
      count: result.current.items!.length,
    });
  });

  it('источники пусты — items пустой массив, failed остаётся false («правда пусто»)', async () => {
    const { result } = renderHook(() => useWarmWords(deps()));
    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(result.current.failed).toBe(false);
  });

  it('запрос упал — failed=true, чтобы экран не сказал «здесь пока пусто»', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps({
      getModeDiary: vi.fn().mockRejectedValue(new Error('offline')),
    });
    const { result } = renderHook(() => useWarmWords(d));

    await waitFor(() => expect(result.current.failed).toBe(true));
    // items тоже пустой — но экран теперь различает эти два случая по failed.
    expect(result.current.items).toEqual([]);
    // Открытие не трекается: человек ничего не увидел, событие было бы враньём.
    expect(d.trackEvent).not.toHaveBeenCalled();
  });

  it('размонтирование до ответа — состояние не трогается (нет setState после unmount)', async () => {
    let resolve!: (v: never[]) => void;
    const d = deps({
      getModeNotes: vi.fn().mockReturnValue(new Promise((r) => (resolve = r))),
    });
    const { result, unmount } = renderHook(() => useWarmWords(d));
    unmount();
    resolve([]);
    await Promise.resolve();

    expect(result.current.items).toBeNull();
    expect(d.trackEvent).not.toHaveBeenCalled();
  });
});
