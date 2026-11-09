// @vitest-environment jsdom
// Кризисная детекция в заметке дневника (CLAUDE.md, правило №7).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NoteSheet } from './NoteSheet';
import { describeCrisisField } from '../test-support/crisisCardHarness';
import { DAY_NOTE_MAX } from '../../../shared/src/limits/textLimits';
import { todayStr } from '../../../shared/src/utils/format';

vi.mock('../api', () => ({
  api: {
    getNote: vi.fn(),
    saveNote: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderSheet() {
  return render(
    <MemoryRouter>
      <NoteSheet date="2026-07-20" onClose={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getNote.mockResolvedValue({ text: '', tags: [] });
});

afterEach(() => {
  cleanup();
});

describeCrisisField('webapp/src/components/NoteSheet.tsx', {
  open: renderSheet,
  enter: (text) =>
    fireEvent.change(screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...'), {
      target: { value: text },
    }),
});

// Загрузка существующей заметки (read-after-write контур: сохранённое должно
// быть найдено при повторном открытии, а не показывать пустое поле).
describe('NoteSheet — загрузка существующей заметки', () => {
  it('предзаполняет текст из api.getNote(date), а не показывает пустое поле', async () => {
    mockApi.getNote.mockResolvedValue({ text: 'Вчера был трудный разговор', tags: [] });
    await act(async () => { renderSheet(); });

    const textarea = screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...') as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value).toBe('Вчера был трудный разговор'));
  });

  it('ошибка api.getNote не роняет экран — поле остаётся пустым, а не выдуманным текстом', async () => {
    mockApi.getNote.mockRejectedValue(new Error('network down'));
    await act(async () => { renderSheet(); });
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Заметка не загрузилась');
  });
});

// Аудит 2026-11, E7: поле до загрузки принимало ввод, поздний ответ его затирал;
// сбой загрузки давал пустую форму, и «Сохранить» перетирало заметку на сервере.
const PLACEHOLDER = 'Что происходило сегодня? Любая мысль...';
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const saveBtn = () => screen.getByText('Сохранить') as HTMLButtonElement;

describe('NoteSheet — гонка загрузки', () => {
  it('до ответа — силуэт без поля, «Сохранить» закрыто', () => {
    mockApi.getNote.mockReturnValue(new Promise(() => {}));
    renderSheet();
    expect(screen.getByRole('status', { name: 'Загружается заметка' })).toBeTruthy();
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
    expect(saveBtn().disabled).toBe(true);
  });

  it('сбой загрузки — «Повторить», сохранить нельзя; повтор приносит заметку в поле', async () => {
    mockApi.getNote.mockRejectedValueOnce(new Error('network down'));
    mockApi.getNote.mockResolvedValueOnce({ text: 'Сохранённое', tags: ['work'] });
    await act(async () => { renderSheet(); });
    expect(saveBtn().disabled).toBe(true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Повторить' })); });
    expect((screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement).value).toBe('Сохранённое');
    expect(screen.getByRole('button', { name: 'Работа' }).getAttribute('aria-pressed')).toBe('true');
    expect(mockApi.getNote).toHaveBeenCalledTimes(2);
  });

  it('ответ прошлого дня, пришедший позже, не попадает в заметку нового дня', async () => {
    const a = deferred<{ text: string; tags: string[] }>();
    const b = deferred<{ text: string; tags: string[] }>();
    mockApi.getNote.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { rerender } = renderSheet();
    rerender(<MemoryRouter><NoteSheet date="2026-07-21" onClose={vi.fn()} /></MemoryRouter>);
    await act(async () => { b.resolve({ text: 'Двадцать первое', tags: [] }); });
    await act(async () => { a.resolve({ text: 'Двадцатое', tags: [] }); });
    expect((screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement).value).toBe('Двадцать первое');
  });

  it('набранное не затирается ответом, пришедшим после ввода', async () => {
    const later = deferred<{ text: string; tags: string[] }>();
    mockApi.getNote.mockResolvedValueOnce({ text: '', tags: [] }).mockReturnValueOnce(later.promise);
    const { rerender } = renderSheet();
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'Пишу прямо сейчас' } });
    rerender(<MemoryRouter><NoteSheet date="2026-07-21" onClose={vi.fn()} /></MemoryRouter>);
    await act(async () => { later.resolve({ text: 'С сервера', tags: ['joy'] }); });
    expect((screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement).value).toBe('Пишу прямо сейчас');
    expect(screen.getByRole('button', { name: 'Радость' }).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('NoteSheet — сохранение', () => {
  it('кнопка «Сохранить» задизейблена на пустой заметке (нет текста и тегов)', async () => {
    await act(async () => { renderSheet(); });
    const saveBtn = screen.getByText('Сохранить') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('успешное сохранение вызывает api.saveNote с обрезанным текстом и датой', async () => {
    mockApi.saveNote.mockResolvedValue(undefined);
    await act(async () => { renderSheet(); });
    fireEvent.change(screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...'), {
      target: { value: '  заметка с пробелами  ' },
    });

    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(() => expect(mockApi.saveNote).toHaveBeenCalledWith('2026-07-20', 'заметка с пробелами', []));
  });

  it('ошибка api.saveNote показывает сообщение, а не тишину, и не закрывает лист', async () => {
    mockApi.saveNote.mockRejectedValue(new Error('network down'));
    await act(async () => { renderSheet(); });
    fireEvent.change(screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...'), {
      target: { value: 'заметка' },
    });

    fireEvent.click(screen.getByText('Сохранить'));

    await screen.findByText('Не удалось сохранить. Попробуй ещё раз.');
    // Лист не закрылся — текст всё ещё в textarea.
    expect((screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...') as HTMLTextAreaElement).value).toBe('заметка');
  });
});

// backend#29: предел заметки дня один (DAY_NOTE_MAX = @MaxLength в DTO) — поле
// его знает и показывает «N/предел», а не молча отдаёт серверу лишнее.
describe('NoteSheet — предел длины', () => {
  it('textarea.maxLength = предел из shared, счётчик «N/предел» виден с первого знака', async () => {
    await act(async () => { renderSheet(); });
    const textarea = screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...') as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(DAY_NOTE_MAX);
    expect(screen.getByText(`0/${DAY_NOTE_MAX}`)).toBeTruthy();
    fireEvent.change(textarea, { target: { value: 'три' } });
    expect(screen.getByText(`3/${DAY_NOTE_MAX}`)).toBeTruthy();
  });
});

// Хвост волны 2 (#1022): слияние аккаунтов склеивает заметки дня, и склейка
// бывает длиннее предела. Сервер пускает её правку без роста; поле не должно
// запирать ввод на 500 — иначе исправить можно только удалением.
describe('NoteSheet — слитая заметка длиннее предела', () => {
  it('предел поля — длина сохранённой заметки, правка уходит на сохранение', async () => {
    const merged = 'а'.repeat(450) + '\n\n' + 'б'.repeat(448);
    mockApi.getNote.mockResolvedValue({ text: merged, tags: [] });
    mockApi.saveNote.mockResolvedValue(undefined);
    await act(async () => { renderSheet(); });
    const textarea = screen.getByPlaceholderText('Что происходило сегодня? Любая мысль...') as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value).toBe(merged));
    expect(textarea.maxLength).toBe(900);
    const edited = 'в' + merged.slice(1);
    fireEvent.change(textarea, { target: { value: edited } });
    await act(async () => { fireEvent.click(screen.getByText('Сохранить')); });
    expect(mockApi.saveNote).toHaveBeenCalledWith('2026-07-20', edited, []);
  });
});

// Надпись листа: сегодня — «Дневник», прошлый день — «Дневник · день недели, число месяц»
// (правило №2: ветвление во фронтенде — с тестом; №25: прогон и под TZ=Australia/Sydney).
describe('NoteSheet — надпись листа по дню', () => {
  const label = async (date: string) => {
    await act(async () => { render(<MemoryRouter><NoteSheet date={date} onClose={vi.fn()} /></MemoryRouter>); });
    return document.querySelector('.pa-sheet-label')!.textContent;
  };

  it('сегодня — просто «Дневник», без даты', async () => {
    expect(await label(todayStr())).toBe('Дневник');
  });

  it('прошлый день — «Дневник · понедельник, 20 июля»: календарный день, а не сдвиг зоны', async () => {
    expect(await label('2026-07-20')).toBe('Дневник · понедельник, 20 июля');
  });
});
