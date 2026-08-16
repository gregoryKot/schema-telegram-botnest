// @vitest-environment jsdom
// useModeMapExport.ts — 0% покрытия. PNG/PDF-экспорт карты режимов. Мокаем
// внешние библиотеки рендера (html-to-image, jspdf) и проверяем реальные
// аргументы вызова + имя файла, а не просто «функция была вызвана».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModeMapExport } from './useModeMapExport';
import type { FlowNode } from './modeMapFlow';

const toPng = vi.fn();
vi.mock('html-to-image', () => ({ toPng: (...args: unknown[]) => toPng(...args) }));

const jsPDFCtor = vi.fn();
const pdfInstance = { addImage: vi.fn(), save: vi.fn() };
vi.mock('jspdf', () => ({
  jsPDF: class {
    constructor(...args: unknown[]) {
      jsPDFCtor(...args);
      return pdfInstance as unknown as InstanceType<typeof this.constructor>;
    }
  },
}));

function node(id: string): FlowNode {
  return { id, position: { x: 0, y: 0 }, data: {} };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

describe('useModeMapExport', () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let createdAnchors: HTMLAnchorElement[];

  beforeEach(() => {
    toPng.mockReset();
    jsPDFCtor.mockReset();
    pdfInstance.addImage.mockReset();
    pdfInstance.save.mockReset();
    document.body.innerHTML = '<div class="react-flow__viewport"></div>';
    clickSpy = vi.fn();
    // jsdom не реализует HTMLAnchorElement.click навигацией — подменяем, чтобы
    // проверить сам факт вызова без побочных эффектов навигации.
    HTMLAnchorElement.prototype.click = clickSpy;
    // Перехватываем document.createElement('a'), чтобы достать созданный якорь
    // (href/download) без опоры на mock.instances (он трекает только `new`).
    createdAnchors = [];
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag);
      if (tag === 'a') createdAnchors.push(el as HTMLAnchorElement);
      return el;
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('на пустой карте (nodes=[]) ничего не рендерит и не падает', async () => {
    const { result } = renderHook(() => useModeMapExport([]));
    await act(async () => { await result.current.onExportPng(); });
    expect(toPng).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
    expect(result.current.exporting).toBe(false);
  });

  it('без элемента .react-flow__viewport в DOM — toPng не вызывается', async () => {
    document.body.innerHTML = '';
    const { result } = renderHook(() => useModeMapExport([node('a')]));
    await act(async () => { await result.current.onExportPng(); });
    expect(toPng).not.toHaveBeenCalled();
    expect(result.current.exporting).toBe(false);
  });

  it('onExportPng рендерит PNG и скачивает файл с именем karta-rezhimov-<дата>.png', async () => {
    toPng.mockResolvedValue('data:image/png;base64,AAA');
    const { result } = renderHook(() => useModeMapExport([node('a'), node('b')]));

    await act(async () => { await result.current.onExportPng(); });

    expect(toPng).toHaveBeenCalledTimes(1);
    const [el, opts] = toPng.mock.calls[0] as [Element, Record<string, unknown>];
    expect(el.classList.contains('react-flow__viewport')).toBe(true);
    expect(opts.width).toBe(1600);
    expect(opts.height).toBe(1100);
    expect(opts.pixelRatio).toBe(2);
    expect((opts.style as { width: string }).width).toBe('1600px');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result.current.exporting).toBe(false);
  });

  it('фильтр экспорта вырезает миникарту/контролы/панели, но пропускает обычные узлы', async () => {
    toPng.mockResolvedValue('data:x');
    const { result } = renderHook(() => useModeMapExport([node('a')]));
    await act(async () => { await result.current.onExportPng(); });

    const [, opts] = toPng.mock.calls[0] as [Element, { filter: (n: Element) => boolean }];
    const minimap = document.createElement('div');
    minimap.className = 'react-flow__minimap';
    const controls = document.createElement('div');
    controls.className = 'react-flow__controls';
    const plainNode = document.createElement('div');
    plainNode.className = 'react-flow__node';

    expect(opts.filter(minimap)).toBe(false);
    expect(opts.filter(controls)).toBe(false);
    expect(opts.filter(plainNode)).toBe(true);
  });

  it('имя PNG-файла содержит дату в формате YYYY-MM-DD', async () => {
    toPng.mockResolvedValue('data:x');
    const { result } = renderHook(() => useModeMapExport([node('a')]));
    await act(async () => { await result.current.onExportPng(); });
    expect(createdAnchors).toHaveLength(1);
    const [, dateStr] = createdAnchors[0].download.replace('.png', '').split('karta-rezhimov-');
    expect(dateStr).toMatch(DATE_RE);
  });

  it('ошибка рендера (toPng падает) гасится — exporting возвращается в false, исключение наружу не летит', async () => {
    toPng.mockRejectedValue(new Error('canvas boom'));
    const { result } = renderHook(() => useModeMapExport([node('a')]));
    await expect(act(async () => { await result.current.onExportPng(); })).resolves.not.toThrow();
    expect(result.current.exporting).toBe(false);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  // Регресс: catch раньше был пустым (`catch { /* ignore */ }`) — сбой рендера
  // не давал ни файла, ни объяснения. exportError — единственный сигнал наружу.
  it('ошибка рендера выставляет exportError=true', async () => {
    toPng.mockRejectedValue(new Error('canvas boom'));
    const { result } = renderHook(() => useModeMapExport([node('a')]));
    expect(result.current.exportError).toBe(false);
    await act(async () => { await result.current.onExportPng(); });
    expect(result.current.exportError).toBe(true);
  });

  it('успешный экспорт не выставляет exportError, а новая попытка сбрасывает прошлую ошибку', async () => {
    toPng.mockRejectedValueOnce(new Error('canvas boom'));
    toPng.mockResolvedValueOnce('data:x');
    const { result } = renderHook(() => useModeMapExport([node('a')]));
    await act(async () => { await result.current.onExportPng(); });
    expect(result.current.exportError).toBe(true);
    await act(async () => { await result.current.onExportPng(); });
    expect(result.current.exportError).toBe(false);
  });

  it('ошибка сборки PDF (import jspdf/рендер падает) тоже выставляет exportError', async () => {
    toPng.mockRejectedValue(new Error('canvas boom'));
    const { result } = renderHook(() => useModeMapExport([node('a')]));
    await act(async () => { await result.current.onExportPdf(); });
    expect(result.current.exportError).toBe(true);
    expect(jsPDFCtor).not.toHaveBeenCalled();
  });

  it('onExportPdf строит jsPDF в альбомной ориентации и сохраняет файл .pdf', async () => {
    toPng.mockResolvedValue('data:image/png;base64,BBB');
    const { result } = renderHook(() => useModeMapExport([node('a')]));

    await act(async () => { await result.current.onExportPdf(); });

    expect(jsPDFCtor).toHaveBeenCalledWith({ orientation: 'landscape', unit: 'px', format: [1600, 1100] });
    expect(pdfInstance.addImage).toHaveBeenCalledWith('data:image/png;base64,BBB', 'PNG', 0, 0, 1600, 1100);
    expect(pdfInstance.save).toHaveBeenCalledTimes(1);
    const [filename] = pdfInstance.save.mock.calls[0] as [string];
    expect(filename.startsWith('karta-rezhimov-')).toBe(true);
    expect(filename.endsWith('.pdf')).toBe(true);
  });

  it('onExportPdf на пустой карте не создаёт PDF (renderPng вернул null раньше jsPDF)', async () => {
    const { result } = renderHook(() => useModeMapExport([]));
    await act(async () => { await result.current.onExportPdf(); });
    expect(jsPDFCtor).not.toHaveBeenCalled();
    expect(pdfInstance.save).not.toHaveBeenCalled();
    expect(result.current.exporting).toBe(false);
  });

  it('exporting=true во время рендера PNG, false после завершения', async () => {
    let resolveToPng: (v: string) => void = () => {};
    toPng.mockReturnValue(new Promise<string>(res => { resolveToPng = res; }));
    const { result } = renderHook(() => useModeMapExport([node('a')]));

    let pending!: Promise<void>;
    act(() => { pending = result.current.onExportPng(); });
    expect(result.current.exporting).toBe(true);

    await act(async () => { resolveToPng('data:x'); await pending; });
    expect(result.current.exporting).toBe(false);
  });
});
