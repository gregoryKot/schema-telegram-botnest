// @vitest-environment jsdom
// DisclaimerNotTherapyStep — второй шаг гейта согласий, показывает подсказку,
// какой из двух чекбоксов ещё не отмечен (0% покрытия). Три ветки подсказки —
// частый источник «написали не ту причину» багов при правке порядка шагов,
// поэтому проверяем каждую отдельно, плюс обе формы обращения.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { DisclaimerNotTherapyStep } from './DisclaimerNotTherapyStep';

afterEach(() => {
  cleanup();
});

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

describe('DisclaimerNotTherapyStep — подсказка гейта', () => {
  it('ready=true — подсказки нет вовсе', () => {
    render(<DisclaimerNotTherapyStep c1 ready c2 setC1={() => {}} />);
    expect(screen.queryByText(/согласи/)).toBeNull();
  });

  it('оба чекбокса не отмечены (c1=false, c2=false) — просит оба', () => {
    renderWithForm(
      <DisclaimerNotTherapyStep
        c1={false}
        ready={false}
        c2={false}
        setC1={() => {}}
      />,
      'ty',
    );
    expect(
      screen.getByText('Отметь оба согласия — здесь и на предыдущем шаге'),
    ).toBeTruthy();
  });

  it('только c1 не отмечен (c2=true) — просит отметить согласие выше', () => {
    render(
      <DisclaimerNotTherapyStep c1={false} ready={false} c2 setC1={() => {}} />,
    );
    expect(screen.getByText('Отметь согласие выше')).toBeTruthy();
  });

  it('c2 не отмечен на предыдущем шаге (c1=true) — просит вернуться назад', () => {
    render(
      <DisclaimerNotTherapyStep c1 ready={false} c2={false} setC1={() => {}} />,
    );
    expect(
      screen.getByText('Вернись на шаг назад и подтверди согласие'),
    ).toBeTruthy();
  });

  it('форма «вы»: подсказка «оба согласия» без «ты»-форм', () => {
    const { container } = renderWithForm(
      <DisclaimerNotTherapyStep
        c1={false}
        ready={false}
        c2={false}
        setC1={() => {}}
      />,
      'vy',
    );
    expect(
      screen.getByText('Отметьте оба согласия — здесь и на предыдущем шаге'),
    ).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });

  it('клик по чекбоксу зовёт setC1 функциональным апдейтером', () => {
    const setC1 = vi.fn();
    render(
      <DisclaimerNotTherapyStep
        c1={false}
        ready={false}
        c2={false}
        setC1={setC1}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(setC1).toHaveBeenCalledTimes(1);
    const updater = setC1.mock.calls[0][0] as (p: boolean) => boolean;
    expect(updater(false)).toBe(true);
  });
});
