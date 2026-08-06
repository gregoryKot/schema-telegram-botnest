// @vitest-environment jsdom
// DisclaimerPrivacyStep — согласие на обработку данных, часть гейта
// онбординга (0% покрытия). Клик по чекбоксу зовёт setC2 функциональным
// апдейтером (p) => !p — регрессия сюда сломала бы галочку молча (текущее
// значение не менялось бы, потому что реальный setState в Disclaimer.tsx
// стоит на функциональной форме).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DisclaimerPrivacyStep } from './DisclaimerPrivacyStep';

afterEach(() => {
  cleanup();
});

describe('DisclaimerPrivacyStep', () => {
  it('c2=false — чекбокс не отмечен', () => {
    render(<DisclaimerPrivacyStep c2={false} setC2={() => {}} />);
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('c2=true — чекбокс отмечен', () => {
    render(<DisclaimerPrivacyStep c2 setC2={() => {}} />);
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('клик по чекбоксу зовёт setC2 функциональным апдейтером, инвертирующим c2', () => {
    const setC2 = vi.fn();
    render(<DisclaimerPrivacyStep c2={false} setC2={setC2} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(setC2).toHaveBeenCalledTimes(1);
    const updater = setC2.mock.calls[0][0] as (p: boolean) => boolean;
    expect(updater(false)).toBe(true);
    expect(updater(true)).toBe(false);
  });

  it('ссылка на политику конфиденциальности ведёт на /privacy', () => {
    render(<DisclaimerPrivacyStep c2={false} setC2={() => {}} />);
    const link = screen.getByText('Политика конфиденциальности →');
    expect(link.getAttribute('href')).toBe('https://schemehappens.ru/privacy');
  });
});
