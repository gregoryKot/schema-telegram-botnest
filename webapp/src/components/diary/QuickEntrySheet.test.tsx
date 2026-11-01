// @vitest-environment jsdom
// «Дневник одной страницей»: что уходит на сервер по каждому тегу, кризисная
// карточка, отказ (лист остаётся), черновик в localStorage, «Заполнить подробно».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuickEntrySheet } from './QuickEntrySheet';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';
import { todayStr } from '../../utils/format';

vi.mock('../../api', () => ({
  api: {
    trackEvent: vi.fn(),
    createSchemaDiary: vi.fn(),
    createModeDiary: vi.fn(),
    createGratitudeDiary: vi.fn(),
    getGratitudeDiary: vi.fn(),
    getProfile: vi.fn(),
  },
}));
import { api } from '../../api';
const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const PLACEHOLDER = 'Можно одним предложением. Можно без точки.';

function setup() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <MemoryRouter>
      <QuickEntrySheet onClose={onClose} onSaved={onSaved} />
    </MemoryRouter>,
  );
  return { onClose, onSaved };
}
const type = (v: string) => fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: v } });
const tag = (label: string) => fireEvent.click(screen.getByRole('radio', { name: label }));
const press = async (label: string) => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: label })); }); };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  m.createSchemaDiary.mockResolvedValue({});
  m.createModeDiary.mockResolvedValue({});
  m.createGratitudeDiary.mockResolvedValue({});
  m.getGratitudeDiary.mockResolvedValue([]);
  m.getProfile.mockResolvedValue({ ysq: { activeSchemaIds: [] } });
});
afterEach(cleanup);

describe('QuickEntrySheet — первый экран', () => {
  it('заголовок, четыре тега, «Просто мысль» выбран, «Сохранить» выключена на пустом тексте', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Что на уме?' })).toBeTruthy();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['Просто мысль', 'Схема', 'Режим', 'Благодарность']);
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    expect((screen.getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Тег необязателен. Схему или режим можно уточнить на следующем шаге.')).toBeTruthy();
  });

  it('кризисный текст показывает CrisisCard; нейтральный — нет', () => {
    setup();
    type('Тёплый чай вечером');
    expect(screen.queryByRole('status')).toBeNull();
    type('не хочу жить');
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('черновик пишется в diary_draft_quick и восстанавливается при открытии', () => {
    setup();
    type('Недописанная мысль');
    expect(localStorage.getItem('diary_draft_quick')).toBe('Недописанная мысль');
    cleanup();
    setup();
    expect((screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement).value).toBe('Недописанная мысль');
  });
});

describe('QuickEntrySheet — сохранение по тегам', () => {
  it('«Просто мысль»: запись схем без схем и эмоций, экран «Записано», черновик стёрт, событие без текста', async () => {
    const { onSaved } = setup();
    type('Опять промолчал');
    await press('Сохранить');
    expect(m.createSchemaDiary).toHaveBeenCalledWith({ trigger: 'Опять промолчал', emotions: [], schemaIds: [] });
    expect(screen.getByRole('heading', { name: 'Записано' })).toBeTruthy();
    expect(screen.getByText('Теперь это есть в записях')).toBeTruthy();
    expect(localStorage.getItem('diary_draft_quick')).toBeNull();
    expect(m.trackEvent).toHaveBeenCalledWith('diary_quick_save', { tag: 'thought', detailed: false });
    expect(JSON.stringify(m.trackEvent.mock.calls)).not.toContain('Опять промолчал');
    expect(onSaved).toHaveBeenCalled();
  });

  it('«Записано»: под кнопками строка «самопомощь, не замена терапии» и «Поговорить →»; кризиса нет — следа нет', async () => {
    setup();
    type('Опять промолчал');
    await press('Сохранить');
    expect(screen.getByText(/Дневник — самопомощь, не замена терапии\. Если нужна терапия, есть с кем поговорить/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Поговорить →' })).toBeTruthy();
    expect(m.trackEvent).toHaveBeenCalledWith('therapy_nudge', { place: 'diary_done', action: 'shown' });
    expect(localStorage.getItem('therapy_crisis_seen_at')).toBeNull();
  });

  it('кризисный текст оставляет локальный след (поднимает карточку на главной)', async () => {
    setup();
    type('не хочу жить');
    await press('Сохранить');
    expect(localStorage.getItem('therapy_crisis_seen_at')).not.toBeNull();
  });

  it('«Схема»: второй экран с чипами, выбор уходит в schemaIds', async () => {
    setup();
    type('Критика на встрече');
    tag('Схема');
    await press('Дальше');
    expect(m.createSchemaDiary).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Какая схема сработала?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Жёсткие стандарты / Придирчивость' }));
    await press('Сохранить');
    expect(m.createSchemaDiary).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'Критика на встрече', emotions: [], schemaIds: [expect.any(String)] }),
    );
    expect(m.trackEvent).toHaveBeenCalledWith('diary_quick_save', { tag: 'schema', detailed: false });
  });

  it('«Схема» → «Пропустить»: запись без схем', async () => {
    setup();
    type('Что-то задело');
    tag('Схема');
    await press('Дальше');
    await press('Пропустить');
    expect(m.createSchemaDiary).toHaveBeenCalledWith({ trigger: 'Что-то задело', emotions: [], schemaIds: [] });
    expect(m.trackEvent).toHaveBeenCalledWith('diary_quick_save', { tag: 'thought', detailed: false });
  });

  it('кризисный текст: карточка видна на втором экране схемы и на «Записано»', async () => {
    setup();
    type('не хочу жить');
    tag('Схема');
    await press('Дальше');
    expect(screen.getByRole('heading', { name: 'Какая схема сработала?' })).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
    await press('Пропустить');
    expect(screen.getByRole('heading', { name: 'Записано' })).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('кризисный текст: карточка видна на экране выбора режима', async () => {
    setup();
    type('не хочу жить');
    tag('Режим');
    await press('Дальше');
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('нейтральный текст: на втором экране карточки нет', async () => {
    setup();
    type('Тёплый чай вечером');
    tag('Схема');
    await press('Дальше');
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });

  it('«Режим»: выбор режима → ситуация + modeId, остальные поля не уходят', async () => {
    setup();
    type('Накричал на ребёнка');
    tag('Режим');
    await press('Дальше');
    fireEvent.click(screen.getByText('Знаю режим – выбрать из списка'));
    await act(async () => { fireEvent.click(screen.getByText('Уязвимый Ребёнок')); });
    expect(m.createModeDiary).toHaveBeenCalledTimes(1);
    const arg = m.createModeDiary.mock.calls[0][0];
    expect(arg).toEqual({ modeId: expect.any(String), situation: 'Накричал на ребёнка' });
    expect(m.trackEvent).toHaveBeenCalledWith('diary_quick_save', { tag: 'mode', detailed: false });
  });

  it('«Благодарность»: пункт дописывается к сегодняшним', async () => {
    m.getGratitudeDiary.mockResolvedValue([{ id: 1, date: todayStr(), items: ['Чай'] }]);
    setup();
    type('Солнце');
    tag('Благодарность');
    await press('Сохранить');
    // base — прочитанный день: сервер сливает с ним и не теряет пункт с другой вкладки.
    expect(m.createGratitudeDiary).toHaveBeenCalledWith(todayStr(), ['Чай', 'Солнце'], ['Чай']);
    expect(m.trackEvent).toHaveBeenCalledWith('diary_quick_save', { tag: 'gratitude', detailed: false });
  });

  it('«Благодарность» в пустой день: base пустой, пункт уходит один', async () => {
    m.getGratitudeDiary.mockResolvedValue([{ id: 1, date: '2000-01-01', items: ['Вчера'] }]);
    setup();
    type('Солнце');
    tag('Благодарность');
    await press('Сохранить');
    expect(m.createGratitudeDiary).toHaveBeenCalledWith(todayStr(), ['Солнце'], []);
  });

  it('«Благодарность», когда пунктов уже пять: сообщение, ничего не уходит, «Записать как мысль» переключает тег', async () => {
    m.getGratitudeDiary.mockResolvedValue([{ id: 1, date: todayStr(), items: ['а', 'б', 'в', 'г', 'д'] }]);
    setup();
    type('Шестое');
    tag('Благодарность');
    await press('Сохранить');
    expect(screen.getByRole('alert').textContent).toMatch(/На сегодня уже пять пунктов/);
    expect(m.createGratitudeDiary).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Записать как мысль' }));
    expect(screen.getByRole('radio', { name: 'Просто мысль' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByRole('alert')).toBeNull();
    await press('Сохранить');
    expect(m.createSchemaDiary).toHaveBeenCalledWith({ trigger: 'Шестое', emotions: [], schemaIds: [] });
  });

  it('«Благодарность», день не загрузился: пункты не затираются, запись не уходит', async () => {
    m.getGratitudeDiary.mockRejectedValue(new Error('offline'));
    setup();
    type('Солнце');
    tag('Благодарность');
    await press('Сохранить');
    expect(m.createGratitudeDiary).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Не удалось сохранить/);
  });
});

describe('QuickEntrySheet — отказ и выход', () => {
  it('отказ сервера: лист остаётся, текст и черновик на месте, кнопка активна, события нет', async () => {
    m.createSchemaDiary.mockRejectedValue(new Error('500'));
    const { onClose } = setup();
    type('Важная мысль');
    await press('Сохранить');
    expect(screen.getByRole('alert').textContent).toMatch(/Не удалось сохранить/);
    expect((screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement).value).toBe('Важная мысль');
    expect((screen.getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement).disabled).toBe(false);
    expect(localStorage.getItem('diary_draft_quick')).toBe('Важная мысль');
    expect(m.trackEvent).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('отказ на втором экране режима возвращает на первый с текстом', async () => {
    m.createModeDiary.mockRejectedValue(new Error('500'));
    setup();
    type('Сорвался');
    tag('Режим');
    await press('Дальше');
    fireEvent.click(screen.getByText('Знаю режим – выбрать из списка'));
    await act(async () => { fireEvent.click(screen.getByText('Уязвимый Ребёнок')); });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect((screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement).value).toBe('Сорвался');
  });

  it('«Ещё одну» возвращает чистое поле с тегом «Просто мысль»; «На главную» закрывает', async () => {
    const { onClose } = setup();
    type('Раз');
    await press('Сохранить');
    await press('Ещё одну');
    expect((screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement).value).toBe('');
    type('Два');
    await press('Сохранить');
    await press('На главную');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('QuickEntrySheet — «Заполнить подробно»', () => {
  it('открывает мастер схем с этим текстом; сохранение в мастере — событие detailed=true и «Записано»', async () => {
    setup();
    type('Подробная мысль');
    await press('Заполнить подробно →');
    const area = screen.getByPlaceholderText('Например: на созвоне А. сказал, что мой ппт «слабо проработан»…') as HTMLTextAreaElement;
    expect(area.value).toBe('Подробная мысль');
    await press('Сохранить');
    expect(m.createSchemaDiary).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'Подробная мысль' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Записано' })).toBeTruthy());
    expect(m.trackEvent).toHaveBeenCalledWith('diary_quick_save', { tag: 'thought', detailed: true });
  });

  it('мастер режима получает текст как ситуацию', async () => {
    setup();
    type('Ситуация для режима');
    tag('Режим');
    await press('Заполнить подробно →');
    fireEvent.click(screen.getByText('Знаю режим – выбрать из списка'));
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    const area = screen.getByDisplayValue('Ситуация для режима');
    expect(area).toBeTruthy();
  });

  it('мастер благодарности получает текст первым пунктом', async () => {
    setup();
    type('Спасибо солнцу');
    tag('Благодарность');
    await press('Заполнить подробно →');
    await waitFor(() => expect(screen.getByDisplayValue('Спасибо солнцу')).toBeTruthy());
  });

  it('закрытие мастера без сохранения возвращает на первый экран с текстом', async () => {
    setup();
    type('Передумал');
    await press('Заполнить подробно →');
    await act(async () => { fireEvent.click(screen.getByText(/Назад к дневнику/)); });
    await waitFor(() => expect((screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement).value).toBe('Передумал'));
  });
});
