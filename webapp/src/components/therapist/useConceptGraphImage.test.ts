// @vitest-environment jsdom
// «Скачать картинкой» (только сайт): снимок узла схемы в PNG через
// html-to-image (мок). Проверяем контракт: узел и фон страницы уходят в
// библиотеку, файл называется «концептуализация.png», управление схемы
// (data-export-skip) в снимок не идёт, отказ виден и уходит в отчёт.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const toPng = vi.fn();
vi.mock('html-to-image', () => ({ toPng: (...a: unknown[]) => toPng(...a) }));
vi.mock('../../api', () => ({ reportClientError: vi.fn() }));
import { reportClientError } from '../../api';
import {
  CONCEPT_IMAGE_FILENAME,
  useConceptGraphImage,
} from './useConceptGraphImage';

const mockReport = reportClientError as unknown as ReturnType<typeof vi.fn>;

let clicked: HTMLAnchorElement[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  clicked = [];
  toPng.mockResolvedValue('data:image/png;base64,AAAA');
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(this);
  });
  document.body.style.backgroundColor = 'rgb(245, 242, 235)';
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.style.backgroundColor = '';
});

const refTo = (el: HTMLElement | null) => ({ current: el });

describe('useConceptGraphImage', () => {
  it('снимает узел с фоном страницы и скачивает «концептуализация.png»', async () => {
    const node = document.createElement('div');
    const { result } = renderHook(() => useConceptGraphImage(refTo(node)));
    await act(async () => {
      await result.current.download();
    });

    expect(toPng).toHaveBeenCalledTimes(1);
    const [target, opts] = toPng.mock.calls[0];
    expect(target).toBe(node);
    expect(opts.backgroundColor).toBe('rgb(245, 242, 235)');
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe(CONCEPT_IMAGE_FILENAME);
    expect(CONCEPT_IMAGE_FILENAME).toBe('концептуализация.png');
    expect(clicked[0].href).toBe('data:image/png;base64,AAAA');
    expect(result.current.busy).toBe(false);
    expect(result.current.failed).toBe(false);
  });

  it('фильтр снимка пропускает схему и отбрасывает управление (data-export-skip)', async () => {
    const node = document.createElement('div');
    const { result } = renderHook(() => useConceptGraphImage(refTo(node)));
    await act(async () => {
      await result.current.download();
    });
    const filter = toPng.mock.calls[0][1].filter as (n: Node) => boolean;

    const card = document.createElement('button');
    const controls = document.createElement('div');
    controls.setAttribute('data-export-skip', 'true');
    expect(filter(card)).toBe(true);
    expect(filter(document.createTextNode('текст'))).toBe(true);
    expect(filter(controls)).toBe(false);
  });

  it('узла нет — ничего не делает', async () => {
    const { result } = renderHook(() => useConceptGraphImage(refTo(null)));
    await act(async () => {
      await result.current.download();
    });
    expect(toPng).not.toHaveBeenCalled();
    expect(clicked).toHaveLength(0);
  });

  it('пока снимок готовится, busy=true', async () => {
    let resolve!: (v: string) => void;
    toPng.mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      }),
    );
    const { result } = renderHook(() =>
      useConceptGraphImage(refTo(document.createElement('div'))),
    );
    let p!: Promise<void>;
    act(() => {
      p = result.current.download();
    });
    await vi.waitFor(() => expect(result.current.busy).toBe(true));
    await act(async () => {
      resolve('data:image/png;base64,B');
      await p;
    });
    expect(result.current.busy).toBe(false);
  });

  it('отказ библиотеки: failed=true, файл не скачивается, ошибка уходит в отчёт', async () => {
    toPng.mockRejectedValue(new Error('canvas tainted'));
    const { result } = renderHook(() =>
      useConceptGraphImage(refTo(document.createElement('div'))),
    );
    await act(async () => {
      await result.current.download();
    });
    expect(result.current.failed).toBe(true);
    expect(result.current.busy).toBe(false);
    expect(clicked).toHaveLength(0);
    expect(mockReport).toHaveBeenCalledWith(
      expect.objectContaining({
        section: 'therapist.conceptGraph',
        message: expect.stringContaining('canvas tainted'),
      }),
    );
  });

  it('повторная попытка после отказа сбрасывает failed', async () => {
    toPng.mockRejectedValueOnce(new Error('x'));
    const { result } = renderHook(() =>
      useConceptGraphImage(refTo(document.createElement('div'))),
    );
    await act(async () => {
      await result.current.download();
    });
    expect(result.current.failed).toBe(true);
    await act(async () => {
      await result.current.download();
    });
    expect(result.current.failed).toBe(false);
    expect(clicked).toHaveLength(1);
  });
});
