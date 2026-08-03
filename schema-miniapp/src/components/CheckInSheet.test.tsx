// @vitest-environment jsdom
// CheckInSheet — чек-ин вчерашнего плана практики (0% покрытия). Правило №4
// («ошибка API видна») — при провале checkinPlan лист НЕ закрывается молча,
// показывает текст ошибки и разблокирует кнопки; плюс регрессия дефекта:
// «попробуй ещё раз» была захардкожена без useTr() (не видела формы «вы»).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { hasTyForms } from '../../../shared/src/utils/tyFormsSweep';
import { CheckInSheet } from './CheckInSheet';
import { api, type PracticePlan } from '../api';

vi.mock('../api', () => ({
  api: { checkinPlan: vi.fn() },
}));

const plan: PracticePlan = {
  id: 42,
  needId: 'safety',
  practiceText: 'Позвонить другу и рассказать о дне',
  scheduledDate: '2026-08-02',
  reminderUtcHour: null,
  done: null,
};

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CheckInSheet — успешный чек-ин', () => {
  it('показывает текст плана и метку потребности', () => {
    render(
      <CheckInSheet
        plan={plan}
        needEmoji="🛡"
        needLabel="Безопасность"
        color="#4fa3f7"
        onDone={() => {}}
      />,
    );
    expect(screen.getByText('Позвонить другу и рассказать о дне')).toBeTruthy();
    expect(screen.getByText('🛡 Безопасность')).toBeTruthy();
  });

  it('«Да, сделал» зовёт checkinPlan(id, true) и onDone', async () => {
    vi.mocked(api.checkinPlan).mockResolvedValue(undefined);
    const onDone = vi.fn();
    render(
      <CheckInSheet
        plan={plan}
        needEmoji="🛡"
        needLabel="Безопасность"
        color="#4fa3f7"
        onDone={onDone}
      />,
    );
    fireEvent.click(screen.getByText('Да, сделал ✓'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.checkinPlan).toHaveBeenCalledWith(42, true);
  });

  it('«Не вышло» зовёт checkinPlan(id, false)', async () => {
    vi.mocked(api.checkinPlan).mockResolvedValue(undefined);
    render(
      <CheckInSheet
        plan={plan}
        needEmoji="🛡"
        needLabel="Безопасность"
        color="#4fa3f7"
        onDone={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Не вышло'));
    await waitFor(() =>
      expect(api.checkinPlan).toHaveBeenCalledWith(42, false),
    );
  });

  it('«Пропустить» закрывает лист без вызова checkinPlan', () => {
    const onDone = vi.fn();
    render(
      <CheckInSheet
        plan={plan}
        needEmoji="🛡"
        needLabel="Безопасность"
        color="#4fa3f7"
        onDone={onDone}
      />,
    );
    fireEvent.click(screen.getByText('Пропустить'));
    expect(onDone).toHaveBeenCalled();
    expect(api.checkinPlan).not.toHaveBeenCalled();
  });
});

describe('CheckInSheet — провал сохранения виден пользователю (правило №4)', () => {
  it('checkinPlan падает — лист НЕ закрывается, ошибка видна, кнопки снова активны', async () => {
    vi.mocked(api.checkinPlan).mockRejectedValue(new Error('network'));
    const onDone = vi.fn();
    render(
      <CheckInSheet
        plan={plan}
        needEmoji="🛡"
        needLabel="Безопасность"
        color="#4fa3f7"
        onDone={onDone}
      />,
    );
    fireEvent.click(screen.getByText('Да, сделал ✓'));
    expect(
      await screen.findByText('Не удалось сохранить — попробуй ещё раз'),
    ).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText('Не вышло').disabled).toBe(false);
  });
});

describe('CheckInSheet — обращение ты/вы (регрессия: было захардкожено)', () => {
  it('форма «ты»', async () => {
    vi.mocked(api.checkinPlan).mockRejectedValue(new Error('x'));
    renderWithForm(
      <CheckInSheet
        plan={plan}
        needEmoji="🛡"
        needLabel="Безопасность"
        color="#4fa3f7"
        onDone={() => {}}
      />,
      'ty',
    );
    expect(screen.getByText('Вчера ты планировал')).toBeTruthy();
    fireEvent.click(screen.getByText('Да, сделал ✓'));
    expect(
      await screen.findByText('Не удалось сохранить — попробуй ещё раз'),
    ).toBeTruthy();
  });

  it('форма «вы» — весь текст согласован, без остаточных «ты»-форм', async () => {
    vi.mocked(api.checkinPlan).mockRejectedValue(new Error('x'));
    const { container } = renderWithForm(
      <CheckInSheet
        plan={plan}
        needEmoji="🛡"
        needLabel="Безопасность"
        color="#4fa3f7"
        onDone={() => {}}
      />,
      'vy',
    );
    expect(screen.getByText('Вчера вы планировали')).toBeTruthy();
    fireEvent.click(screen.getByText('Да, сделал ✓'));
    await screen.findByText('Не удалось сохранить — попробуйте ещё раз');
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});
