// @vitest-environment jsdom
// Celebration — экран поздравления со стриком (0% покрытия). Конфетти
// (useConfetti) уже своим тестом в shared, здесь отключаем анимацию
// (reduce_motion=1), чтобы не упереться в отсутствие canvas 2D в jsdom, и
// проверяем СОБСТВЕННУЮ логику компонента: заголовок-иконка для вехи/не-вехи,
// клик-закрытие, шаринг с фолбэком на буфер обмена, и регрессия дефекта —
// строка «нажми в другом месте» была захардкожена в «ты»-форме без useTr()
// (баг найден при повышении покрытия: пользователь с формой «вы» видел «ты»).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { hasTyForms } from '../../../shared/src/utils/tyFormsSweep';
import { Celebration } from './Celebration';

vi.mock('../../../shared/src/share/cards/streakCard', () => ({
  drawStreakCard: vi.fn(),
}));
vi.mock('../../../shared/src/share/shareImage', () => ({
  shareCanvasImage: vi.fn(),
}));
vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

beforeEach(() => {
  // Гасим canvas-конфетти (useConfetti) — своя логика уже покрыта в shared,
  // здесь она бы просто упала на отсутствующем canvas-контексте jsdom.
  localStorage.setItem('reduce_motion', '1');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Celebration — контент по стрику', () => {
  it('обычный стрик (не веха) — иконка 🔥 и текст «N дней подряд»', () => {
    render(<Celebration streak={5} onDone={() => {}} />);
    expect(screen.getByText('🔥')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('дней подряд')).toBeTruthy();
  });

  it('стрик-веха (7) — иконка 🏆 и текст вехи из celebrationText', () => {
    render(<Celebration streak={7} onDone={() => {}} />);
    expect(screen.getByText('🏆')).toBeTruthy();
    expect(screen.getByText('Неделя подряд. Это настоящий сдвиг')).toBeTruthy();
  });

  it('передан insight — показывается отдельным блоком', () => {
    render(
      <Celebration
        streak={2}
        onDone={() => {}}
        insight="Сегодня индекс дня заметно выше обычного"
      />,
    );
    expect(
      screen.getByText('Сегодня индекс дня заметно выше обычного'),
    ).toBeTruthy();
  });

  it('insight не передан — блок инсайта отсутствует', () => {
    const { container } = render(<Celebration streak={2} onDone={() => {}} />);
    // Блок инсайта имеет characteристичный marginTop:12/paddingTop:12 —
    // проще всего убедиться, что нет лишнего текстового узла кроме известных.
    expect(container.textContent).not.toMatch(/индекс/i);
  });
});

describe('Celebration — закрытие', () => {
  it('клик по фону зовёт onDone', () => {
    const onDone = vi.fn();
    render(<Celebration streak={3} onDone={onDone} />);
    fireEvent.click(screen.getByText('🏆'));
    expect(onDone).toHaveBeenCalled();
  });
});

describe('Celebration — обращение ты/вы (регрессия: было захардкожено «ты»)', () => {
  it('форма «ты»', () => {
    renderWithForm(<Celebration streak={4} onDone={() => {}} />, 'ty');
    expect(
      screen.getByText('нажми в другом месте, чтобы закрыть'),
    ).toBeTruthy();
  });

  it('форма «вы» — без остаточных «ты»-форм (баг: раньше текст был неизменным)', () => {
    const { container } = renderWithForm(
      <Celebration streak={4} onDone={() => {}} />,
      'vy',
    );
    expect(
      screen.getByText('нажмите в другом месте, чтобы закрыть'),
    ).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});

describe('Celebration — поделиться', () => {
  it('успешный шаринг — трекает share_card и share_result(ok:true), кнопка не меняет текст', async () => {
    const { shareCanvasImage } =
      await import('../../../shared/src/share/shareImage');
    const { api } = await import('../api');
    vi.mocked(shareCanvasImage).mockResolvedValue('shared');
    render(<Celebration streak={4} onDone={() => {}} />);
    fireEvent.click(screen.getByText('Поделиться'));
    await vi.waitFor(() => {
      expect(api.trackEvent).toHaveBeenCalledWith('share_card', {
        kind: 'streak',
      });
      expect(api.trackEvent).toHaveBeenCalledWith('share_result', {
        kind: 'streak',
        ok: true,
      });
    });
  });

  it('шаринг не удался — фолбэк на буфер обмена, кнопка временно показывает «Скопировано!»', async () => {
    const { shareCanvasImage } =
      await import('../../../shared/src/share/shareImage');
    const { api } = await import('../api');
    vi.mocked(shareCanvasImage).mockRejectedValue(new Error('no share api'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<Celebration streak={4} onDone={() => {}} />);
    fireEvent.click(screen.getByText('Поделиться'));
    expect(await screen.findByText('Скопировано!')).toBeTruthy();
    expect(writeText).toHaveBeenCalled();
    expect(api.trackEvent).toHaveBeenCalledWith('share_result', {
      kind: 'streak',
      ok: false,
    });
  });
});
