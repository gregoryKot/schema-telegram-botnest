// @vitest-environment jsdom
// Админ-вкладка «Фото на сайте»: загрузка → сжатие (мокаем compressImage —
// canvas/createImageBitmap не поддерживаются jsdom, это чужая ответственность
// imageCompress.ts) → сохранение. Проверяем, что ошибка API видна пользователю
// и не выглядит как успех (класс бага, который в проекте находили трижды).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
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

describe('PhotoSection — текущее фото (не заглушка)', () => {
  it('на чистом контенте — фолбэк-картинка сайта, не выдуманный путь', async () => {
    render(<PhotoSection adminKey="k" />);
    await waitFor(() => expect(mockApi.getSiteContent).toHaveBeenCalled());
    const img = await screen.findByAltText('Текущее фото');
    expect((img as HTMLImageElement).src).toContain('/gregory.jpg');
  });

  it('реальное heroPhoto из API отображается как текущее', async () => {
    mockApi.getSiteContent.mockResolvedValue({ heroPhoto: 'data:image/jpeg;base64,REAL' });
    render(<PhotoSection adminKey="k" />);
    const img = await screen.findByAltText('Текущее фото');
    expect((img as HTMLImageElement).src).toBe('data:image/jpeg;base64,REAL');
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
    render(<PhotoSection adminKey="k" />);
    await screen.findByAltText('Текущее фото');
    uploadFile(document.querySelector('input[type="file"]')!);
    await screen.findByAltText('Новое фото');

    fireEvent.click(screen.getByRole('button', { name: /Сохранить фото/ }));

    await screen.findByText('Фото сохранено ✓');
    expect(mockApi.adminSetHeroPhoto).toHaveBeenCalledWith('k', 'data:image/jpeg;base64,NEW');
    expect((screen.getByAltText('Текущее фото') as HTMLImageElement).src).toBe('data:image/jpeg;base64,NEW');
    expect(screen.queryByAltText('Новое фото')).toBeNull();
  });

  it('ошибка сохранения на сервере — видна, старое фото остаётся текущим (не молчаливый успех)', async () => {
    mockCompress.mockResolvedValue('data:image/jpeg;base64,NEW');
    mockApi.adminSetHeroPhoto.mockRejectedValue(new Error('Сервер недоступен'));
    mockApi.getSiteContent.mockResolvedValue({ heroPhoto: 'data:image/jpeg;base64,OLD' });
    render(<PhotoSection adminKey="k" />);
    await screen.findByAltText('Текущее фото');
    uploadFile(document.querySelector('input[type="file"]')!);
    await screen.findByAltText('Новое фото');

    fireEvent.click(screen.getByRole('button', { name: /Сохранить фото/ }));

    await screen.findByText('Сервер недоступен');
    expect((screen.getByAltText('Текущее фото') as HTMLImageElement).src).toBe('data:image/jpeg;base64,OLD');
  });
});
