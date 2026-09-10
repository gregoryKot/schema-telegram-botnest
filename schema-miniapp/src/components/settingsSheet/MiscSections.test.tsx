// @vitest-environment jsdom
// Настройки: имя, «поделиться» и вход в данные/удаление (CLAUDE.md —
// приоритет покрытия «настройки: удаление данных, экспорт»). Поведение:
// сохранение имени только когда оно реально изменилось, экспорт сводки для
// терапевта (через Web Share API и через фолбэк на буфер обмена), переходы
// в приватность/удаление.
import type { ReactElement } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { NameSection, ShareSection, DataSection } from './MiscSections';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';

vi.mock('../../api', () => ({
  api: {
    updateName: vi.fn(),
    getExport: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('../../apiClient', () => ({ authedFetch: vi.fn() }));
import { authedFetch } from '../../apiClient';
const mockAuthedFetch = authedFetch as unknown as ReturnType<typeof vi.fn>;

function exportResponse(over: Partial<Response> = {}): Response {
  return {
    ok: true,
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="export.json"',
    }),
    blob: () => Promise.resolve(new Blob(['{}'])),
    ...over,
  } as Response;
}

function renderWithForm(ui: ReactElement, form: AddressForm = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
});

describe('NameSection', () => {
  function renderSection(
    overrides: Partial<React.ComponentProps<typeof NameSection>> = {},
  ) {
    const setEditName = vi.fn();
    const setNameSaving = vi.fn();
    const onNameChanged = vi.fn();
    const setSavedToast = vi.fn();
    render(
      <NameSection
        editName="Аня"
        displayName="Аня"
        tgName="Аня"
        nameSaving={false}
        setEditName={setEditName}
        setNameSaving={setNameSaving}
        onNameChanged={onNameChanged}
        setSavedToast={setSavedToast}
        {...overrides}
      />,
    );
    return { setEditName, setNameSaving, onNameChanged, setSavedToast };
  }

  it('имя совпадает с сохранённым — кнопка «Сохранить» не показана', () => {
    renderSection();
    expect(screen.queryByText('Сохранить')).toBeNull();
  });

  it('имя изменено — кнопка появляется, клик сохраняет через api и вызывает onNameChanged', async () => {
    mockApi.updateName.mockResolvedValue(undefined);
    const { onNameChanged, setSavedToast } = renderSection({
      editName: 'Новое имя',
    });
    const saveBtn = screen.getByText('Сохранить');
    fireEvent.click(saveBtn);

    await waitFor(() =>
      expect(mockApi.updateName).toHaveBeenCalledWith('Новое имя'),
    );
    expect(onNameChanged).toHaveBeenCalledWith('Новое имя');
    expect(setSavedToast).toHaveBeenCalledWith(true);
  });

  it('ввод в поле вызывает setEditName с новым значением', () => {
    const { setEditName } = renderSection();
    fireEvent.change(screen.getByPlaceholderText('Твоё имя'), {
      target: { value: 'Б' },
    });
    expect(setEditName).toHaveBeenCalledWith('Б');
  });

  it('показывает telegram-имя подсказкой, когда оно отличается от текущего', () => {
    renderSection({
      editName: 'Другое',
      tgName: 'ТгИмя',
      displayName: 'Другое',
    });
    expect(screen.getByText('В Telegram: ТгИмя')).toBeTruthy();
  });
});

describe('ShareSection — экспорт для терапевта', () => {
  it('Web Share API доступен — делится напрямую, не трогает буфер и не открывает оверлей', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    mockApi.getExport.mockResolvedValue({ text: 'Сводка за 30 дней' });
    const setExportText = vi.fn();

    render(<ShareSection setExportText={setExportText} />);
    fireEvent.click(screen.getByText('Для терапевта'));

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({ text: 'Сводка за 30 дней' }),
    );
    expect(setExportText).not.toHaveBeenCalled();
  });

  it('нет Web Share API — копирует в буфер и открывает оверлей с текстом', async () => {
    Object.assign(navigator, { share: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    mockApi.getExport.mockResolvedValue({ text: 'Сводка за 30 дней' });
    const setExportText = vi.fn();

    render(<ShareSection setExportText={setExportText} />);
    fireEvent.click(screen.getByText('Для терапевта'));

    await waitFor(() =>
      expect(setExportText).toHaveBeenCalledWith('Сводка за 30 дней'),
    );
    expect(writeText).toHaveBeenCalledWith('Сводка за 30 дней');
  });

  it('клик «Пригласить друга» открывает карточку приглашения', () => {
    render(<ShareSection setExportText={() => {}} />);
    fireEvent.click(screen.getByText('Пригласить друга'));
    // ShareCardSheet рендерится через портал поверх ряда — теперь заголовок
    // встречается дважды (ряд настроек + заголовок шита с картинкой).
    expect(screen.getAllByText('Пригласить друга').length).toBe(2);
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
  });
});

describe('DataSection', () => {
  it('клик «О данных и конфиденциальности» вызывает onPrivacy', () => {
    const onPrivacy = vi.fn();
    render(<DataSection onPrivacy={onPrivacy} onDelete={() => {}} />);
    fireEvent.click(screen.getByText('О данных и конфиденциальности'));
    expect(onPrivacy).toHaveBeenCalledTimes(1);
  });

  it('клик «Удалить все данные» вызывает onDelete', () => {
    const onDelete = vi.fn();
    render(<DataSection onPrivacy={() => {}} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Удалить все данные'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

// Право на переносимость данных (PR #480 — бэкенд; кнопка — эта задача).
// Общая логика — shared/src/account/useDataExport.ts (правило №3), здесь —
// только интеграция в мини-апп: клик доходит до authedFetch (initData уже
// внутри него), и каждый исход виден пользователю в нужной форме.
describe('DataSection — скачать мои данные', () => {
  function renderData(form: AddressForm = 'ty') {
    return renderWithForm(
      <DataSection onPrivacy={() => {}} onDelete={() => {}} />,
      form,
    );
  }

  it('клик уходит в authedFetch с авторизацией', async () => {
    mockAuthedFetch.mockResolvedValue(exportResponse());
    renderData();
    fireEvent.click(screen.getByText('Скачать мои данные'));

    await waitFor(() =>
      expect(mockAuthedFetch).toHaveBeenCalledWith('/api/account/export'),
    );
    await waitFor(() =>
      expect(screen.getByText('Скачать мои данные')).toBeTruthy(),
    );
  });

  it('пока файл готовится — кнопка сама меняет текст, не спиннер экрана', async () => {
    let resolve!: (r: Response) => void;
    mockAuthedFetch.mockReturnValue(
      new Promise<Response>((r) => (resolve = r)),
    );
    renderData();
    fireEvent.click(screen.getByText('Скачать мои данные'));

    await screen.findByText('Собираю…');
    resolve(exportResponse());
    await waitFor(() =>
      expect(screen.getByText('Скачать мои данные')).toBeTruthy(),
    );
  });

  it('запрос упал — видно сообщение об ошибке, не тишина', async () => {
    mockAuthedFetch.mockRejectedValue(new Error('network down'));
    renderData();
    fireEvent.click(screen.getByText('Скачать мои данные'));

    await screen.findByText(/Не удалось скачать файл/);
  });

  it('ты/вы: сообщение об ошибке скачивания звучит в обеих формах', async () => {
    mockAuthedFetch.mockRejectedValue(new Error('network down'));
    renderData('ty');
    fireEvent.click(screen.getByText('Скачать мои данные'));
    await screen.findByText(
      'Не удалось скачать файл. Проверь связь и попробуй ещё раз',
    );
    cleanup();

    mockAuthedFetch.mockRejectedValue(new Error('network down'));
    renderData('vy');
    fireEvent.click(screen.getByText('Скачать мои данные'));
    await screen.findByText(
      'Не удалось скачать файл. Проверьте связь и попробуйте ещё раз',
    );
  });

  it('после успешного скачивания видно, чего ждать, — а не молчаливый возврат кнопки', async () => {
    mockAuthedFetch.mockResolvedValue(exportResponse());
    renderData();
    fireEvent.click(screen.getByText('Скачать мои данные'));

    // Тот же класс, что и в webapp: клик без исключения ещё не значит, что
    // файл у человека появился (правило №14).
    await screen.findByText(/Файл ушёл в загрузки/);
  });

  it('вебвью без download у <a> — явная подсказка открыть сайт, а не молчание', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLAnchorElement.prototype,
      'download',
    );
    delete (HTMLAnchorElement.prototype as unknown as Record<string, unknown>)
      .download;
    try {
      renderData();
      fireEvent.click(screen.getByText('Скачать мои данные'));
      await screen.findByText(/Тут скачать не получится/);
      expect(mockAuthedFetch).not.toHaveBeenCalled();
    } finally {
      if (descriptor)
        Object.defineProperty(
          HTMLAnchorElement.prototype,
          'download',
          descriptor,
        );
    }
  });

  it('ты/вы: пояснение рядом с кнопкой звучит в обеих формах', () => {
    renderData('ty');
    expect(
      screen.getByText(/Скачай, если хочешь сохранить копию себе/),
    ).toBeTruthy();
    cleanup();

    renderData('vy');
    expect(
      screen.getByText(/Скачайте, если хотите сохранить копию себе/),
    ).toBeTruthy();
  });
});
