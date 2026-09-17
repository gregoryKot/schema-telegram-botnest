// @vitest-environment jsdom
// PlanSheet — было 0% покрытия (57 непокрытых строк). Проверяем: выбор
// готового варианта vs свой текст, сохранение плана (реальный расчёт
// reminderUtcHour из таймзоны), ошибку сохранения (правило CLAUDE.md
// «свободный текст → пользователь должен увидеть правду»), удаление своей
// практики (успех/неуспех) и обе формы ты/вы для подписи текстового поля.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { PlanSheet } from './PlanSheet';
import { CRISIS_HOTLINE_DISPLAY } from '../utils/crisisMarkers';
import { setHost, type HostBridge } from '../../../shared/src/host';

vi.mock('../api', () => ({
  api: {
    getPractices: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue({ notifyTimezone: 'Europe/Moscow' }),
    addPractice: vi.fn().mockResolvedValue(undefined),
    createPlan: vi.fn().mockResolvedValue(undefined),
    deletePractice: vi.fn().mockResolvedValue(undefined),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderSheet(
  props: Partial<Parameters<typeof PlanSheet>[0]> = {},
  form: 'ty' | 'vy' = 'ty',
) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const utils = render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter>
        <PlanSheet
          needId="attachment"
          needColor="#60a5fa"
          needLabel="Привязанность"
          color="#60a5fa"
          onClose={onClose}
          onSaved={onSaved}
          {...props}
        />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
  return { ...utils, onClose, onSaved };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getPractices.mockResolvedValue([]);
  mockApi.getSettings.mockResolvedValue({ notifyTimezone: 'Europe/Moscow' });
  mockApi.addPractice.mockResolvedValue(undefined);
  mockApi.createPlan.mockResolvedValue(undefined);
  mockApi.deletePractice.mockResolvedValue(undefined);
});

afterEach(() => { cleanup(); setHost(null); });

describe('PlanSheet — выбор готового варианта', () => {
  it('клик по готовой практике переводит в подтверждение с текстом практики', async () => {
    await act(async () => renderSheet());
    const [option] = await screen.findAllByText(/Написать кому-то близкому без повода/);
    fireEvent.click(option);
    expect(screen.getByText('Запланировать')).toBeTruthy();
    expect(screen.getAllByText(/Написать кому-то близкому без повода/).length).toBeGreaterThan(0);
  });
});

describe('PlanSheet — свой текст', () => {
  it('кнопка «Продолжить →» появляется только когда есть текст, и ведёт к подтверждению', async () => {
    await act(async () => renderSheet());
    expect(screen.queryByText('Продолжить →')).toBeNull();
    const textarea = screen.getByPlaceholderText('Что-то конкретное, маленькое...');
    fireEvent.change(textarea, { target: { value: 'Погулять в парке 20 минут' } });
    fireEvent.click(screen.getByText('Продолжить →'));
    expect(screen.getAllByText(/Погулять в парке 20 минут/).length).toBeGreaterThan(0);
  });

  it('без готовых вариантов подпись поля меняется по форме обращения ты/вы', async () => {
    await act(async () => renderSheet({ needId: 'nonexistent_need' }, 'vy'));
    expect(screen.getByText('Что планируете?')).toBeTruthy();
  });

  it('форма «ты» по умолчанию показывает «Что планируешь?»', async () => {
    await act(async () => renderSheet({ needId: 'nonexistent_need' }, 'ty'));
    expect(screen.getByText('Что планируешь?')).toBeTruthy();
  });
});

describe('PlanSheet — сохранение плана', () => {
  it('«Днём» напоминание пересчитывается в UTC-час из реальной таймзоны пользователя', async () => {
    await act(async () => renderSheet());
    const textarea = screen.getByPlaceholderText('Что-то конкретное, маленькое...');
    fireEvent.change(textarea, { target: { value: 'Своя практика' } });
    fireEvent.click(screen.getByText('Продолжить →'));

    fireEvent.click(screen.getByText('Днём'));
    fireEvent.click(screen.getByText('Сохранить план'));

    await waitFor(() => expect(mockApi.createPlan).toHaveBeenCalled());
    // Europe/Moscow = UTC+3, «Днём» = 13:00 локально → 10 UTC.
    expect(mockApi.createPlan).toHaveBeenCalledWith('attachment', 'Своя практика', 10);
    expect(mockApi.addPractice).toHaveBeenCalledWith('attachment', 'Своя практика');
  });

  it('«Без напоминания» отправляет reminderUtcHour = undefined', async () => {
    await act(async () => renderSheet());
    const textarea = screen.getByPlaceholderText('Что-то конкретное, маленькое...');
    fireEvent.change(textarea, { target: { value: 'Практика без будильника' } });
    fireEvent.click(screen.getByText('Продолжить →'));

    fireEvent.click(screen.getByText('Без напоминания'));
    fireEvent.click(screen.getByText('Сохранить план'));

    await waitFor(() => expect(mockApi.createPlan).toHaveBeenCalled());
    expect(mockApi.createPlan).toHaveBeenCalledWith('attachment', 'Практика без будильника', undefined);
  });

  it('после успешного сохранения кнопка показывает «Запланировано», а затем вызывает onSaved', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { onSaved } = renderSheet();
    await act(async () => {});
    const textarea = screen.getByPlaceholderText('Что-то конкретное, маленькое...');
    fireEvent.change(textarea, { target: { value: 'Практика' } });
    fireEvent.click(screen.getByText('Продолжить →'));
    await act(async () => {
      fireEvent.click(screen.getByText('Сохранить план'));
    });
    expect(screen.getByText('Запланировано')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('уже добавленную свою практику не отправляет повторно в addPractice', async () => {
    mockApi.getPractices.mockResolvedValue([{ id: 1, needId: 'attachment', text: 'Уже была' }]);
    await act(async () => renderSheet());
    const [option] = await screen.findAllByText('Уже была');
    fireEvent.click(option);
    fireEvent.click(screen.getByText('Сохранить план'));
    await waitFor(() => expect(mockApi.createPlan).toHaveBeenCalled());
    expect(mockApi.addPractice).not.toHaveBeenCalled();
  });
});

describe('PlanSheet — ошибка сохранения', () => {
  it('провал api.createPlan показывает сообщение об ошибке (обе формы), а не тишину', async () => {
    mockApi.createPlan.mockRejectedValue(new Error('network'));
    await act(async () => renderSheet({}, 'vy'));
    const textarea = screen.getByPlaceholderText('Что-то конкретное, маленькое...');
    fireEvent.change(textarea, { target: { value: 'Практика' } });
    fireEvent.click(screen.getByText('Продолжить →'));
    await act(async () => {
      fireEvent.click(screen.getByText('Сохранить план'));
    });
    expect(screen.getByText('Не удалось сохранить. Попробуйте ещё раз.')).toBeTruthy();
    // Кнопка не залипает в «сохранении» — можно попробовать снова.
    expect(screen.getByText('Сохранить план')).toBeTruthy();
  });

  it('форма «ты»: сообщение об ошибке в форме ты', async () => {
    mockApi.createPlan.mockRejectedValue(new Error('network'));
    await act(async () => renderSheet({}, 'ty'));
    const textarea = screen.getByPlaceholderText('Что-то конкретное, маленькое...');
    fireEvent.change(textarea, { target: { value: 'Практика' } });
    fireEvent.click(screen.getByText('Продолжить →'));
    await act(async () => {
      fireEvent.click(screen.getByText('Сохранить план'));
    });
    expect(screen.getByText('Не удалось сохранить. Попробуй ещё раз.')).toBeTruthy();
  });
});

describe('PlanSheet — удаление своей практики', () => {
  it('успешное удаление убирает практику из списка', async () => {
    mockApi.getPractices.mockResolvedValue([{ id: 5, needId: 'attachment', text: 'Моя практика' }]);
    await act(async () => renderSheet());
    expect(screen.getAllByText('Моя практика').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('Удалить'));
    await waitFor(() => expect(mockApi.deletePractice).toHaveBeenCalledWith(5));
    await waitFor(() => expect(screen.queryByText('Моя практика')).toBeNull());
  });

  it('неудачное удаление оставляет практику видимой (не теряет данные молча)', async () => {
    mockApi.getPractices.mockResolvedValue([{ id: 6, needId: 'attachment', text: 'Стойкая практика' }]);
    mockApi.deletePractice.mockRejectedValue(new Error('network'));
    await act(async () => renderSheet());
    fireEvent.click(screen.getByLabelText('Удалить'));
    await waitFor(() => expect(mockApi.deletePractice).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.getAllByText('Стойкая практика').length).toBeGreaterThan(0);
  });
});

describe('PlanSheet — .ics-экспорт (паритет с мини-аппом, правило №16)', () => {
  it('клик «Добавить в календарь» зовёт host.saveFile с .ics файлом', async () => {
    const saveFile = vi.fn();
    setHost({ id: 'web', saveFile } as unknown as HostBridge);
    await act(async () => renderSheet());
    const textarea = screen.getByPlaceholderText('Что-то конкретное, маленькое...');
    fireEvent.change(textarea, { target: { value: 'Своя практика' } });
    fireEvent.click(screen.getByText('Продолжить →'));

    fireEvent.click(screen.getByText('Добавить в календарь (.ics)'));
    expect(saveFile).toHaveBeenCalledWith(
      expect.stringContaining('text/calendar'),
      'practice.ics',
    );
  });
});

describe('PlanSheet — кризисная детекция (правило №7)', () => {
  it('кризисный маркер в свободном тексте плана показывает CrisisCard с телефоном доверия', async () => {
    await act(async () => renderSheet());
    const textarea = screen.getByPlaceholderText('Что-то конкретное, маленькое...');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('нейтральный текст плана не показывает CrisisCard', async () => {
    await act(async () => renderSheet());
    const textarea = screen.getByPlaceholderText('Что-то конкретное, маленькое...');
    fireEvent.change(textarea, { target: { value: 'Погулять в парке 20 минут' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('PlanSheet — useHistorySheet (браузерная «Назад»)', () => {
  it('кнопка «Назад» на шаге выбора закрывает лист через goBack (не оставляет висящую историю)', async () => {
    const { onClose } = renderSheet();
    await act(async () => {});
    fireEvent.click(screen.getByText('Назад'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('на шаге подтверждения «← Выбрать другое» возвращает к выбору, а НЕ закрывает лист', async () => {
    const { onClose } = renderSheet();
    await act(async () => {});
    const textarea = screen.getByPlaceholderText('Что-то конкретное, маленькое...');
    fireEvent.change(textarea, { target: { value: 'Практика' } });
    fireEvent.click(screen.getByText('Продолжить →'));
    fireEvent.click(screen.getByText('← Выбрать другое'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Что-то конкретное, маленькое...')).toBeTruthy();
  });
});

describe('PlanSheet — сбой загрузки своих практик (сбой ≠ пусто)', () => {
  // Регрессия: отказ getPractices глушился — свои практики молча пропадали
  // из выбора, человек видел только готовый список, как будто своих нет.
  it('отказ getPractices — видна строка отказа, готовые варианты остаются', async () => {
    mockApi.getPractices.mockRejectedValue(new Error('offline'));
    renderSheet();
    await act(async () => {});

    expect(screen.getByRole('alert').textContent).toContain(
      'Не удалось загрузить твои практики',
    );
    // Кураторский список работает — деградация, не пустота.
    expect(screen.getByText('Готовые варианты')).toBeTruthy();
  });

  it('успешная загрузка — строки отказа нет', async () => {
    mockApi.getPractices.mockResolvedValue([]);
    renderSheet();
    await act(async () => {});
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
