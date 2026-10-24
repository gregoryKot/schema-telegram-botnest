// @vitest-environment jsdom
// «Колесо детства»: пять ползунков-рейтингов без свободного текста (крисис-
// детекция здесь не нужна — нечего детектить). Проверяем реальный расчёт
// среднего, обе ветки итогового текста и, главное, связку сохранение→открытие:
// повторный заход обязан показать СОХРАНЁННЫЙ результат, а не пятёрки, которые
// при сохранении затёрли бы настоящие ответы (потеря данных, паритет 2026-10).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChildhoodWheelEx } from './ChildhoodWheelEx';
import { AddressFormContext } from '../../utils/addressForm';

vi.mock('../../api', () => ({
  api: {
    saveChildhoodRatings: vi.fn(),
    getChildhoodRatings: vi.fn(),
    updateSettings: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderEx(onSaved = vi.fn(), onOpenSchemas?: () => void) {
  return render(
    <MemoryRouter>
      <ChildhoodWheelEx onBack={vi.fn()} onSaved={onSaved} onOpenSchemas={onOpenSchemas} />
    </MemoryRouter>,
  );
}

/** Первое прохождение: вступление → ползунки. */
async function openFill() {
  fireEvent.click(await screen.findByRole('button', { name: /Оценить детство/ }));
}

function dragFirstTrackTo(clientX: number) {
  const track = document.querySelectorAll('.ex2-cw-track')[0] as HTMLDivElement;
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
    left: 0, right: 200, width: 200, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON() {},
  } as DOMRect);
  // jsdom не реализует Pointer Capture API — компонент его вызывает при drag-старте.
  track.setPointerCapture = vi.fn();
  fireEvent.pointerDown(track, { clientX, pointerId: 1 });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.saveChildhoodRatings.mockResolvedValue(undefined);
  mockApi.getChildhoodRatings.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
});

describe('ChildhoodWheelEx — первое прохождение', () => {
  it('сначала вступление «откуда и зачем», ползунков ещё нет', async () => {
    renderEx();
    await screen.findByText(/систематически не удовлетворялись в детстве/);
    expect(document.querySelectorAll('.ex2-cw-track').length).toBe(0);
  });

  it('все пять потребностей начинаются с середины шкалы (5/10)', async () => {
    renderEx();
    await openFill();
    const values = screen.getAllByText('5', { selector: '.ex2-cw-value' });
    expect(values.length).toBe(5);
  });

  it('примеры раскрываются под потребностью, тап по примеру показывает историю', async () => {
    renderEx();
    await openFill();
    fireEvent.click(screen.getAllByRole('button', { name: /Примеры – как это выглядит в жизни/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: /≈2\/10/ }));
    expect(screen.getByText(/Мама пила/)).toBeTruthy();
  });
});

describe('ChildhoodWheelEx — повторное открытие (read-after-write)', () => {
  const SAVED = { attachment: 2, autonomy: 8, expression: 6, play: 9, limits: 7 };

  it('сохранённый результат показывается сразу, без вступления и без записи в БД', async () => {
    mockApi.getChildhoodRatings.mockResolvedValue(SAVED);
    renderEx();
    await screen.findByText(/Среднее 6.4\/10/);
    expect(screen.getByRole('button', { name: '✎ Изменить' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Оценить детство/ })).toBeNull();
    expect(mockApi.saveChildhoodRatings).not.toHaveBeenCalled();
  });

  it('«Изменить» открывает ползунки с СОХРАНЁННЫМИ значениями, а не с пятёрками', async () => {
    mockApi.getChildhoodRatings.mockResolvedValue(SAVED);
    renderEx();
    fireEvent.click(await screen.findByRole('button', { name: '✎ Изменить' }));
    expect(screen.getAllByText('9', { selector: '.ex2-cw-value' }).length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    await screen.findByText(/Среднее 6.4\/10/);
    // Сохранилось ровно то, что было (регресс: раньше уходили пятёрки).
    expect(mockApi.saveChildhoodRatings).toHaveBeenCalledWith(SAVED);
  });

  it('«Отмена» при правке возвращает к сохранённому результату и не пишет в БД', async () => {
    mockApi.getChildhoodRatings.mockResolvedValue(SAVED);
    renderEx();
    fireEvent.click(await screen.findByRole('button', { name: '✎ Изменить' }));
    dragFirstTrackTo(200);
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    await screen.findByText(/Среднее 6.4\/10/);
    expect(mockApi.saveChildhoodRatings).not.toHaveBeenCalled();
  });

  it('сбой загрузки не подсовывает пятёрки: сообщение и «Повторить»', async () => {
    mockApi.getChildhoodRatings.mockRejectedValueOnce(new Error('offline'));
    mockApi.getChildhoodRatings.mockResolvedValueOnce(SAVED);
    renderEx();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(document.querySelectorAll('.ex2-cw-track').length).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await screen.findByText(/Среднее 6.4\/10/);
  });
});

describe('ChildhoodWheelEx — результат и сохранение (read-after-write)', () => {
  it('без изменений — среднее 5/10, все зоны выше 4, блок «Хорошее детство»', async () => {
    renderEx();
    await openFill();
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));

    await screen.findByText(/Среднее 5\/10/);
    expect(screen.getByText('Хорошее детство по всем зонам')).toBeTruthy();
    expect(screen.queryByText('Возможные активные схемы')).toBeNull();
    expect(mockApi.saveChildhoodRatings).toHaveBeenCalledWith({
      attachment: 5, autonomy: 5, expression: 5, play: 5, limits: 5,
    });
  });

  it('onSaved вызывается с реальными оценками, а не с константой', async () => {
    const onSaved = vi.fn();
    renderEx(onSaved);
    await openFill();
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    await screen.findByText(/Среднее 5\/10/);
    expect(onSaved).toHaveBeenCalledWith({ attachment: 5, autonomy: 5, expression: 5, play: 5, limits: 5 });
  });

  it('«✎ Изменить» возвращает на экран слайдеров с теми же значениями', async () => {
    renderEx();
    await openFill();
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    await screen.findByText(/Среднее 5\/10/);

    fireEvent.click(screen.getByRole('button', { name: '✎ Изменить' }));
    expect(screen.getByRole('button', { name: /Посмотреть результат/ })).toBeTruthy();
  });

  // Раньше ошибка сохранения молча игнорировалась («best-effort»), и экран
  // всё равно переходил к результату — тот же экран-тупик, что нашли в
  // FlashcardEx (аудит 2026-08-22, находка №2): человек уходит с уверенностью,
  // что колесо сохранено, а на деле запрос не прошёл. useSavingAction теперь
  // держит на экране слайдеров и показывает сообщение об ошибке.
  it('ошибка сохранения показывает сообщение и НЕ переходит к результату', async () => {
    mockApi.saveChildhoodRatings.mockRejectedValue(new Error('offline'));
    const onSaved = vi.fn();
    renderEx(onSaved);
    await openFill();
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText(/Среднее 5\/10/)).toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('после ошибки повторное нажатие с рабочей сетью успешно сохраняет (retry)', async () => {
    mockApi.saveChildhoodRatings.mockRejectedValueOnce(new Error('offline'));
    renderEx();
    await openFill();
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    await screen.findByText(/Среднее 5\/10/);
  });
});

describe('ChildhoodWheelEx — ты/вы: подсказка «Связать с сегодня»', () => {
  async function renderForm(form: 'ty' | 'vy') {
    render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
          <ChildhoodWheelEx onBack={vi.fn()} onSaved={vi.fn()} />
        </AddressFormContext.Provider>
      </MemoryRouter>,
    );
    await openFill();
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    await screen.findByText(/Среднее 5\/10/);
  }

  it('форма «ты»', async () => {
    await renderForm('ty');
    expect(screen.getByText(/^Открой дневник за последнюю неделю и сравни/)).toBeTruthy();
  });

  it('форма «вы»', async () => {
    await renderForm('vy');
    expect(screen.getByText(/^Откройте дневник за последнюю неделю и сравните/)).toBeTruthy();
  });
});

describe('ChildhoodWheelEx — низкие зоны', () => {
  it('перетаскивание ползунка ниже 4 показывает текст «дефицита» под вопросом', async () => {
    renderEx();
    await openFill();
    dragFirstTrackTo(20);
    // 20/200 * 10 = 1 → низкая зона (<=4) → показывается low-текст первой потребности.
    expect(screen.getByText(/Взрослый отсутствовал или был непредсказуем/)).toBeTruthy();
  });

  it('низкая зона доезжает до результата: «1 зона ниже 5» и схемы привязанности', async () => {
    renderEx();
    await openFill();
    dragFirstTrackTo(20);
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    await screen.findByText(/1 зона ниже 5/);
    expect(screen.getByText('Возможные активные схемы')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Покинутость / Нестабильность' })).toBeTruthy();
    expect(screen.queryByText('Хорошее детство по всем зонам')).toBeNull();
  });

  it('тап по схеме открывает её описание', async () => {
    renderEx();
    await openFill();
    dragFirstTrackTo(20);
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Дефективность / Стыд' }));
    expect(screen.getByRole('heading', { name: 'Дефективность / Стыд' })).toBeTruthy();
  });

  it('«Подробнее о схемах» зовёт onOpenSchemas', async () => {
    const onOpenSchemas = vi.fn();
    renderEx(vi.fn(), onOpenSchemas);
    await openFill();
    dragFirstTrackTo(20);
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    fireEvent.click(await screen.findByText('Подробнее о схемах'));
    expect(onOpenSchemas).toHaveBeenCalledTimes(1);
  });

  it('без onOpenSchemas ссылки «Подробнее о схемах» нет', async () => {
    renderEx();
    await openFill();
    dragFirstTrackTo(20);
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    await screen.findByText('Возможные активные схемы');
    expect(screen.queryByText('Подробнее о схемах')).toBeNull();
  });
});
