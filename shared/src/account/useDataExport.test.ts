// @vitest-environment jsdom
// Право на переносимость данных: fetch авторизованный, поэтому скачивание
// идёт через Blob + object URL, а не через прямую <a href>. Тесты держат три
// вещи: успешный путь чистит за собой object URL, сетевой отказ и отказ
// вебвью (нет download-атрибута) не молчат — каждый даёт свой явный статус.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataExport } from './useDataExport';

function makeResponse(over: Partial<Response> = {}): Response {
  return {
    ok: true,
    headers: new Headers({
      'Content-Disposition':
        'attachment; filename="schemehappens-export-2026-09-10.json"',
    }),
    blob: () => Promise.resolve(new Blob(['{}'], { type: 'application/json' })),
    ...over,
  } as Response;
}

beforeEach(() => {
  // jsdom не реализует Blob URL — стабим сами, чтобы проверить создание/чистку.
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
});

// Каждый тест, который перехватывает document.createElement, обязан начинать
// с настоящей реализации — без восстановления второй такой тест обернул бы
// УЖЕ подменённый createElement и ушёл в бесконечную рекурсию.
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('успешный путь', () => {
  it('запрос уходит через authedFetch (авторизация уже внутри него)', async () => {
    const authedFetch = vi.fn().mockResolvedValue(makeResponse());
    const { result } = renderHook(() => useDataExport({ authedFetch }));

    await act(async () => {
      await result.current.exportData();
    });

    expect(authedFetch).toHaveBeenCalledWith('/api/account/export');
    // Не возврат в idle: после успешного клика экран обязан сказать, чего
    // ждать. Вебвью умеет проглотить скачивание молча, и «кнопка вернулась
    // в исходный вид» человек прочитает как «ничего не произошло».
    expect(result.current.status).toBe('done');
  });

  it('object URL создаётся под скачивание и чистится после клика', async () => {
    const authedFetch = vi.fn().mockResolvedValue(makeResponse());
    const clickSpy = vi.fn();
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    const { result } = renderHook(() => useDataExport({ authedFetch }));
    await act(async () => {
      await result.current.exportData();
    });

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(result.current.status).toBe('done');
  });

  it('во время запроса статус loading — кнопка может показать «Собираю…»', async () => {
    let resolve!: (r: Response) => void;
    const authedFetch = vi
      .fn()
      .mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    const { result } = renderHook(() => useDataExport({ authedFetch }));

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.exportData();
    });
    expect(result.current.status).toBe('loading');

    await act(async () => {
      resolve(makeResponse());
      await pending;
    });
    expect(result.current.status).toBe('done');
  });
});

describe('вебвью проглотил скачивание молча', () => {
  it('после успешного клика статус НЕ возвращается в idle — иначе тишина неотличима от «ничего не просили»', async () => {
    const authedFetch = vi.fn().mockResolvedValue(makeResponse());
    const { result } = renderHook(() => useDataExport({ authedFetch }));

    await act(async () => {
      await result.current.exportData();
    });

    // Ровно тот класс, из-за которого вход в мини-апп молчал пять суток
    // (правило №14): обработанная авария невидимее необработанной. Клик мог
    // пройти без исключения, а файла у человека нет — экран обязан сказать,
    // чего ждать и что делать, если файл не появился.
    expect(result.current.status).not.toBe('idle');
    expect(result.current.status).toBe('done');
  });
});

describe('запрос упал', () => {
  it('сервер ответил не 2xx — статус error, а не тишина', async () => {
    const authedFetch = vi.fn().mockResolvedValue(makeResponse({ ok: false }));
    const { result } = renderHook(() => useDataExport({ authedFetch }));

    await act(async () => {
      await result.current.exportData();
    });

    expect(result.current.status).toBe('error');
  });

  it('сеть недоступна (authedFetch бросает) — тоже статус error', async () => {
    const authedFetch = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useDataExport({ authedFetch }));

    await act(async () => {
      await result.current.exportData();
    });

    expect(result.current.status).toBe('error');
  });
});

describe('скачивание не поддерживается', () => {
  it('нет атрибута download у <a> — статус unsupported, сеть не трогаем', async () => {
    // 'download' in el проверяет ВЕСЬ цикл прототипов, поэтому имитировать
    // старый вебвью можно только сняв accessor с самого прототипа — удаление
    // с инстанса ничего не даёт, jsdom вернёт его через HTMLAnchorElement.prototype.
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLAnchorElement.prototype,
      'download',
    );
    delete (HTMLAnchorElement.prototype as unknown as Record<string, unknown>)
      .download;
    const authedFetch = vi.fn();
    try {
      const { result } = renderHook(() => useDataExport({ authedFetch }));

      await act(async () => {
        await result.current.exportData();
      });

      expect(authedFetch).not.toHaveBeenCalled();
      expect(result.current.status).toBe('unsupported');
    } finally {
      if (descriptor)
        Object.defineProperty(
          HTMLAnchorElement.prototype,
          'download',
          descriptor,
        );
    }
  });

  it('сама проверка поддержки бросает исключение — тоже unsupported, а не краш', async () => {
    // document.createElement('a') ломается в совсем странном вебвью —
    // проверка поддержки обязана не кидать наружу, а тоже дать «не получится».
    // Тестовый рендер тоже зовёт createElement (свой контейнер) — рвём только
    // тег 'a', иначе упал бы сам renderHook, а не проверяемый код.
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') throw new Error('createElement недоступен');
      return realCreate(tag);
    });
    const authedFetch = vi.fn();
    const { result } = renderHook(() => useDataExport({ authedFetch }));

    await act(async () => {
      await result.current.exportData();
    });

    expect(authedFetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe('unsupported');
  });

  it('клик по <a download> бросает исключение — тоже unsupported, файл не потерян молча', async () => {
    const authedFetch = vi.fn().mockResolvedValue(makeResponse());
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a')
        el.click = () => {
          throw new Error('webview blocked it');
        };
      return el;
    });

    const { result } = renderHook(() => useDataExport({ authedFetch }));
    await act(async () => {
      await result.current.exportData();
    });

    expect(result.current.status).toBe('unsupported');
    // Object URL создан (мы дошли до попытки клика) и обязан быть освобождён,
    // даже когда сам клик сорвался — иначе Blob висит в памяти навсегда.
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

describe('имя файла', () => {
  it('берёт имя из Content-Disposition, когда он долетел', async () => {
    const authedFetch = vi.fn().mockResolvedValue(makeResponse());
    const realCreate = document.createElement.bind(document);
    let capturedDownload = '';
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        el.click = vi.fn();
        Object.defineProperty(el, 'download', {
          get: () => capturedDownload,
          set: (v: string) => (capturedDownload = v),
          configurable: true,
        });
      }
      return el;
    });

    const { result } = renderHook(() => useDataExport({ authedFetch }));
    await act(async () => {
      await result.current.exportData();
    });

    expect(capturedDownload).toBe('schemehappens-export-2026-09-10.json');
  });

  it('заголовок недоступен (CORS не открыл его) — есть безопасный дефолт', async () => {
    const authedFetch = vi
      .fn()
      .mockResolvedValue(makeResponse({ headers: new Headers() }));
    const realCreate = document.createElement.bind(document);
    let capturedDownload = '';
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        el.click = vi.fn();
        Object.defineProperty(el, 'download', {
          get: () => capturedDownload,
          set: (v: string) => (capturedDownload = v),
          configurable: true,
        });
      }
      return el;
    });

    const { result } = renderHook(() => useDataExport({ authedFetch }));
    await act(async () => {
      await result.current.exportData();
    });

    expect(capturedDownload).toBe('schemehappens-export.json');
  });

  it('заголовок пришёл, но без filename (прокси срезал часть) — тот же безопасный дефолт', async () => {
    const authedFetch = vi.fn().mockResolvedValue(
      makeResponse({
        headers: new Headers({ 'Content-Disposition': 'attachment' }),
      }),
    );
    const realCreate = document.createElement.bind(document);
    let capturedDownload = '';
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        el.click = vi.fn();
        Object.defineProperty(el, 'download', {
          get: () => capturedDownload,
          set: (v: string) => (capturedDownload = v),
          configurable: true,
        });
      }
      return el;
    });

    const { result } = renderHook(() => useDataExport({ authedFetch }));
    await act(async () => {
      await result.current.exportData();
    });

    expect(capturedDownload).toBe('schemehappens-export.json');
  });
});
