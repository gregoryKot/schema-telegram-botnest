// @vitest-environment jsdom
// «Колесо детства»: пять ползунков-рейтингов без свободного текста (крисис-
// детекция здесь не нужна — нечего детектить). Проверяем реальный расчёт
// среднего и обе ветки итогового текста (низкие зоны / все зоны в норме),
// а не выдуманные числа.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChildhoodWheelEx } from './ChildhoodWheelEx';
import { AddressFormContext } from '../../utils/addressForm';

vi.mock('../../api', () => ({
  api: {
    saveChildhoodRatings: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderEx(onSaved = vi.fn()) {
  return render(
    <MemoryRouter>
      <ChildhoodWheelEx onBack={vi.fn()} onSaved={onSaved} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.saveChildhoodRatings.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('ChildhoodWheelEx — стартовое состояние (не выдумка, дефолт-старт слайдера)', () => {
  it('все пять потребностей начинаются с середины шкалы (5/10)', () => {
    renderEx();
    const values = screen.getAllByText('5', { selector: '.cw-row-value' });
    expect(values.length).toBe(5);
  });
});

describe('ChildhoodWheelEx — результат и сохранение (read-after-write)', () => {
  it('без изменений — среднее 5/10, все зоны выше 4 (нет заниженных)', async () => {
    renderEx();
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));

    await screen.findByText(/Среднее 5\/10/);
    expect(screen.getByText(/Все зоны выше 4/)).toBeTruthy();
    expect(mockApi.saveChildhoodRatings).toHaveBeenCalledWith({
      attachment: 5, autonomy: 5, expression: 5, play: 5, limits: 5,
    });
  });

  it('onSaved вызывается с реальными оценками, а не с константой', async () => {
    const onSaved = vi.fn();
    renderEx(onSaved);
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    await screen.findByText(/Среднее 5\/10/);
    expect(onSaved).toHaveBeenCalledWith({ attachment: 5, autonomy: 5, expression: 5, play: 5, limits: 5 });
  });

  it('«Пересмотреть оценки» возвращает на экран слайдеров с теми же значениями', async () => {
    renderEx();
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    await screen.findByText(/Среднее 5\/10/);

    fireEvent.click(screen.getByRole('button', { name: 'Пересмотреть оценки' }));
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
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText(/Среднее 5\/10/)).toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('после ошибки повторное нажатие с рабочей сетью успешно сохраняет (retry)', async () => {
    mockApi.saveChildhoodRatings.mockRejectedValueOnce(new Error('offline'));
    renderEx();
    const btn = screen.getByRole('button', { name: /Посмотреть результат/ });
    fireEvent.click(btn);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    await screen.findByText(/Среднее 5\/10/);
  });
});

describe('ChildhoodWheelEx — ты/вы: подсказка «Связать с сегодня»', () => {
  it('форма «ты»', async () => {
    render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
          <ChildhoodWheelEx onBack={vi.fn()} onSaved={vi.fn()} />
        </AddressFormContext.Provider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    await screen.findByText(/Среднее 5\/10/);
    expect(screen.getByText(/^Открой дневник за последнюю неделю и сравни/)).toBeTruthy();
  });

  it('форма «вы»', async () => {
    render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form: 'vy', setForm: vi.fn() }}>
          <ChildhoodWheelEx onBack={vi.fn()} onSaved={vi.fn()} />
        </AddressFormContext.Provider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    await screen.findByText(/Среднее 5\/10/);
    expect(screen.getByText(/^Откройте дневник за последнюю неделю и сравните/)).toBeTruthy();
  });
});

describe('ChildhoodWheelEx — низкие зоны меняют подсказку и итоговый текст', () => {
  it('перетаскивание ползунка ниже 4 показывает текст «дефицита» под вопросом', () => {
    renderEx();
    const tracks = document.querySelectorAll('.cw-track');
    const track = tracks[0] as HTMLDivElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 200, width: 200, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON() {},
    } as DOMRect);
    // jsdom не реализует Pointer Capture API — компонент его вызывает при drag-старте.
    track.setPointerCapture = vi.fn();
    fireEvent.pointerDown(track, { clientX: 20, pointerId: 1 });

    // 20/200 * 10 = 1 → низкая зона (<=4) → показывается low-текст первой потребности.
    expect(screen.getByText(/Взрослый отсутствовал или был непредсказуем/)).toBeTruthy();
  });

  it('низкая зона доезжает до итогового экрана: «N зон ниже 5»', async () => {
    renderEx();
    const track = document.querySelectorAll('.cw-track')[0] as HTMLDivElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 200, width: 200, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON() {},
    } as DOMRect);
    track.setPointerCapture = vi.fn();
    fireEvent.pointerDown(track, { clientX: 20, pointerId: 1 });

    fireEvent.click(screen.getByRole('button', { name: /Посмотреть результат/ }));
    await screen.findByText(/1 зон ниже 5/);
  });
});
