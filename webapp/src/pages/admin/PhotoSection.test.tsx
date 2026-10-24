// @vitest-environment jsdom
// Админ-вкладка «Фото на сайте»: загрузка → сжатие (мокаем compressImage —
// canvas/createImageBitmap не поддерживаются jsdom, это чужая ответственность
// imageCompress.ts) → сохранение. Проверяем, что ошибка API видна пользователю
// и не выглядит как успех (класс бага, который в проекте находили трижды).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { PhotoSection } from './PhotoSection';

vi.mock('../../api', () => ({
  api: {
    getSiteContent: vi.fn(),
    adminSetHeroPhoto: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('./imageCompress', () => ({
  compressImage: vi.fn(),
}));
import { compressImage } from './imageCompress';
const mockCompress = compressImage as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getSiteContent.mockResolvedValue({ heroPhoto: null });
});

afterEach(() => {
  cleanup();
});

function uploadFile(input: HTMLElement) {
  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
}

// «Текущее фото» рисуется сразу, с фолбэком, а значение из API подставляется
// позже: getSiteContent → then → setCurrent. findByAltText находит картинку на
// первом кадре и о том, что ответ уже применён, не говорит. Синхронный expect
// сразу за ним зелёный лишь пока промис успел разрешиться и React — перерисовать
// (CI, PR #725, 2026-10-16: не успели). Ждём значение, а не наличие элемента.
const currentSrc = () => (screen.getByAltText('Текущее фото') as HTMLImageElement).src;

// Когда в ответе API пусто (heroPhoto: null), по DOM «ответ применён» не
// отличить от «ответа ещё нет»: фолбэк стоит и там, и там. Промис держим в
// руках: then компонента навешан в эффекте раньше нашего await, значит, к
// выходу из act ответ разобран и перерисован. Без этого запоздавший ответ мог
// бы затереть то, что тест успел сохранить (read-after-write).
async function renderSettled(heroPhoto: string | null) {
  const response = Promise.resolve({ heroPhoto });
  mockApi.getSiteContent.mockReturnValue(response);
  render(<PhotoSection adminKey="k" />);
  await act(async () => { await response; });
}

describe('PhotoSection — текущее фото (не заглушка)', () => {
  it('на чистом контенте — фолбэк-картинка сайта, не выдуманный путь', async () => {
    // Фолбэк на экране и до ответа API, так что проверка на первом кадре зелёная
    // что бы компонент ни сделал с пустым ответом. Ждём сам ответ.
    await renderSettled(null);
    expect(mockApi.getSiteContent).toHaveBeenCalled();
    expect(currentSrc()).toContain('/gregory.jpg');
  });

  it('реальное heroPhoto из API отображается как текущее', async () => {
    mockApi.getSiteContent.mockResolvedValue({ heroPhoto: 'data:image/jpeg;base64,REAL' });
    render(<PhotoSection adminKey="k" />);
    await waitFor(() => expect(currentSrc()).toBe('data:image/jpeg;base64,REAL'));
  });
});

describe('PhotoSection — загрузка и сохранение', () => {
  it('выбор файла показывает превью, кнопка сохранить появляется', async () => {
    mockCompress.mockResolvedValue('data:image/jpeg;base64,NEW');
    render(<PhotoSection adminKey="k" />);
    await screen.findByAltText('Текущее фото');
    uploadFile(document.querySelector('input[type="file"]')!);

    const preview = await screen.findByAltText('Новое фото');
    expect((preview as HTMLImageElement).src).toBe('data:image/jpeg;base64,NEW');
    expect(screen.getByRole('button', { name: /Сохранить фото/ })).toBeTruthy();
  });

  it('ошибка сжатия — видна пользователю, кнопка сохранить не появляется', async () => {
    mockCompress.mockRejectedValue(new Error('Файл слишком большой'));
    render(<PhotoSection adminKey="k" />);
    await screen.findByAltText('Текущее фото');
    uploadFile(document.querySelector('input[type="file"]')!);

    await screen.findByText('Файл слишком большой');
    expect(screen.queryByRole('button', { name: /Сохранить фото/ })).toBeNull();
  });

  it('сохранил → текущее фото на экране становится новым (read-after-write)', async () => {
    mockCompress.mockResolvedValue('data:image/jpeg;base64,NEW');
    mockApi.adminSetHeroPhoto.mockResolvedValue({ ok: true });
    await renderSettled(null);
    uploadFile(document.querySelector('input[type="file"]')!);
    await screen.findByAltText('Новое фото');

    fireEvent.click(screen.getByRole('button', { name: /Сохранить фото/ }));

    await screen.findByText('Фото сохранено ✓');
    expect(mockApi.adminSetHeroPhoto).toHaveBeenCalledWith('k', 'data:image/jpeg;base64,NEW');
    expect(currentSrc()).toBe('data:image/jpeg;base64,NEW');
    expect(screen.queryByAltText('Новое фото')).toBeNull();
  });

  it('ошибка сохранения на сервере — видна, старое фото остаётся текущим (не молчаливый успех)', async () => {
    mockCompress.mockResolvedValue('data:image/jpeg;base64,NEW');
    mockApi.adminSetHeroPhoto.mockRejectedValue(new Error('Сервер недоступен'));
    mockApi.getSiteContent.mockResolvedValue({ heroPhoto: 'data:image/jpeg;base64,OLD' });
    render(<PhotoSection adminKey="k" />);
    // Предусловие: OLD уже стал текущим. Иначе «остаётся OLD» проверяло бы фолбэк.
    await waitFor(() => expect(currentSrc()).toBe('data:image/jpeg;base64,OLD'));
    uploadFile(document.querySelector('input[type="file"]')!);
    await screen.findByAltText('Новое фото');

    fireEvent.click(screen.getByRole('button', { name: /Сохранить фото/ }));

    await screen.findByText('Сервер недоступен');
    expect(currentSrc()).toBe('data:image/jpeg;base64,OLD');
  });
});
