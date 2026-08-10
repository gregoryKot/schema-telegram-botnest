// @vitest-environment jsdom
// ArticleEditor: форма создания/редактирования статьи. compressImage
// мокается (canvas/createImageBitmap не поддерживаются jsdom, отдельная
// ответственность imageCompress.test.ts — см. PhotoSection.test.tsx для того
// же паттерна). TipTap-редактор реально монтируется — в отличие от
// ArticlesSection.test.tsx мы не обходим экран редактирования, а проверяем
// именно его: валидацию, DTO, который улетает на сервер, и что ошибка
// сохранения видна пользователю, а не молча проглатывается.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ArticleEditor } from './ArticleEditor';
import type { Article } from '../../api';

vi.mock('../../api', () => ({
  api: {
    adminCreateArticle: vi.fn(),
    adminUpdateArticle: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('./imageCompress', () => ({
  compressImage: vi.fn(),
}));
import { compressImage } from './imageCompress';
const mockCompress = compressImage as unknown as ReturnType<typeof vi.fn>;

const existingArticle: Article = {
  id: 7,
  slug: 'trevoga-i-telo',
  title: 'Тревога и тело',
  description: 'Как тело реагирует на тревогу',
  date: '2026-01-10T00:00:00.000Z',
  readMin: 6,
  heroImage: null,
  diagramKey: null,
  content: '<p>Текст</p>',
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

function uploadFile(input: HTMLElement) {
  const file = new File(['x'], 'hero.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('ArticleEditor — новая статья', () => {
  it('заголовок формы «Новая статья», поля пустые', () => {
    render(<ArticleEditor adminKey="k" article={null} onDone={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Новая статья')).toBeTruthy();
    expect((screen.getByPlaceholderText('moya-statya') as HTMLInputElement).value).toBe('');
  });

  it('пустой заголовок/slug — ошибка видна, запрос не уходит', () => {
    render(<ArticleEditor adminKey="k" article={null} onDone={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(screen.getByText('Заполните заголовок и slug')).toBeTruthy();
    expect(mockApi.adminCreateArticle).not.toHaveBeenCalled();
  });

  it('валидные поля — создаёт статью через adminCreateArticle с собранным DTO, потом onDone', async () => {
    mockApi.adminCreateArticle.mockResolvedValue(existingArticle);
    const onDone = vi.fn();
    render(<ArticleEditor adminKey="admin-key" article={null} onDone={onDone} onCancel={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('moya-statya'), { target: { value: '  novaya-statya  ' } });
    const titleInput = screen.getByText('Заголовок').nextElementSibling as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: '  Новая статья  ' } });

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mockApi.adminCreateArticle).toHaveBeenCalledTimes(1);
    const [key, dto] = mockApi.adminCreateArticle.mock.calls[0];
    expect(key).toBe('admin-key');
    // Пробелы обрезаны, readMin — целое ≥1, content — HTML из TipTap.
    expect(dto).toMatchObject({
      slug: 'novaya-statya',
      title: 'Новая статья',
      readMin: 5,
      diagramKey: null,
    });
    expect(typeof dto.content).toBe('string');
  });

  it('ошибка сохранения — видна пользователю, onDone НЕ вызывается (не молчаливый провал)', async () => {
    mockApi.adminCreateArticle.mockRejectedValue(new Error('Slug уже занят'));
    const onDone = vi.fn();
    render(<ArticleEditor adminKey="k" article={null} onDone={onDone} onCancel={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('moya-statya'), { target: { value: 'dup-slug' } });
    const titleInput = screen.getByText('Заголовок').nextElementSibling as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Заголовок' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await screen.findByText('Slug уже занят');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('«Отмена» вызывает onCancel', () => {
    const onCancel = vi.fn();
    render(<ArticleEditor adminKey="k" article={null} onDone={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('ArticleEditor — редактирование существующей статьи', () => {
  it('поля предзаполнены данными статьи', () => {
    render(<ArticleEditor adminKey="k" article={existingArticle} onDone={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Редактировать статью')).toBeTruthy();
    expect((screen.getByPlaceholderText('moya-statya') as HTMLInputElement).value).toBe('trevoga-i-telo');
    const titleInput = screen.getByText('Заголовок').nextElementSibling as HTMLInputElement;
    expect(titleInput.value).toBe('Тревога и тело');
  });

  it('сохранение зовёт adminUpdateArticle с id существующей статьи', async () => {
    mockApi.adminUpdateArticle.mockResolvedValue(existingArticle);
    const onDone = vi.fn();
    render(<ArticleEditor adminKey="k" article={existingArticle} onDone={onDone} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mockApi.adminUpdateArticle).toHaveBeenCalledWith('k', 7, expect.objectContaining({ slug: 'trevoga-i-telo' }));
    expect(mockApi.adminCreateArticle).not.toHaveBeenCalled();
  });

  it('кнопка «Сохранение…» блокируется, пока запрос летит', async () => {
    let resolveSave!: (v: Article) => void;
    mockApi.adminUpdateArticle.mockReturnValue(new Promise((r) => { resolveSave = r; }));
    render(<ArticleEditor adminKey="k" article={existingArticle} onDone={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    const btn = await screen.findByRole('button', { name: 'Сохранение…' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    resolveSave(existingArticle);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Сохранить' })).toBeTruthy());
  });
});

describe('ArticleEditor — картинка-хедер', () => {
  it('успешная загрузка — превью появляется, кнопка «Убрать» его очищает', async () => {
    mockCompress.mockResolvedValue('data:image/jpeg;base64,NEW');
    const { container } = render(<ArticleEditor adminKey="k" article={null} onDone={() => {}} onCancel={() => {}} />);
    uploadFile(container.querySelector('input[type="file"]')!);

    await waitFor(() => expect(container.querySelector('img')).toBeTruthy());
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.src).toBe('data:image/jpeg;base64,NEW');
    // Бюджет под хедер — 160кб, отдельный от бюджета обычных картинок PhotoSection.
    expect(mockCompress).toHaveBeenCalledWith(expect.any(File), 1400, 160 * 1024);

    fireEvent.click(screen.getByRole('button', { name: 'Убрать' }));
    expect(container.querySelector('img')).toBeNull();
  });

  it('ошибка сжатия — видна пользователю, превью не появляется', async () => {
    mockCompress.mockRejectedValue(new Error('Файл повреждён'));
    const { container } = render(<ArticleEditor adminKey="k" article={null} onDone={() => {}} onCancel={() => {}} />);
    uploadFile(container.querySelector('input[type="file"]')!);

    await screen.findByText('Файл повреждён');
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('ArticleEditor — тулбар редактора', () => {
  it('клики по кнопкам форматирования не роняют экран', () => {
    render(<ArticleEditor adminKey="k" article={existingArticle} onDone={() => {}} onCancel={() => {}} />);
    for (const name of ['Жирный', 'Курсив', 'Заголовок 2', 'Заголовок 3', 'Разделитель', 'Отменить', 'Повторить']) {
      expect(() => fireEvent.click(screen.getByRole('button', { name }))).not.toThrow();
    }
    // Кнопки списков без aria-label — только текст.
    expect(() => fireEvent.click(screen.getByText('• Список'))).not.toThrow();
    expect(() => fireEvent.click(screen.getByText('1. Список'))).not.toThrow();
  });
});

describe('ArticleEditor — описание и диаграмма', () => {
  it('описание и выбор диаграммы попадают в сохраняемый DTO', async () => {
    mockApi.adminCreateArticle.mockResolvedValue(existingArticle);
    render(<ArticleEditor adminKey="k" article={null} onDone={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('moya-statya'), { target: { value: 'slug' } });
    const titleInput = screen.getByText('Заголовок').nextElementSibling as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Заголовок' } });
    fireEvent.change(screen.getByText('Описание (для карточки и превью)').nextElementSibling as HTMLTextAreaElement, {
      target: { value: '  Краткое описание  ' },
    });
    fireEvent.change(screen.getByText('Диаграмма (рисуется после первого абзаца, вне текста)').nextElementSibling as HTMLSelectElement, {
      target: { value: 'cycle' },
    });
    fireEvent.change(screen.getByText('Время чтения (мин)').nextElementSibling as HTMLInputElement, {
      target: { value: '12' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(mockApi.adminCreateArticle).toHaveBeenCalled());
    const [, dto] = mockApi.adminCreateArticle.mock.calls[0];
    expect(dto.description).toBe('Краткое описание');
    expect(dto.diagramKey).toBe('cycle');
    expect(dto.readMin).toBe(12);
  });
});
