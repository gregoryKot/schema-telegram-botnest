// @vitest-environment jsdom
// Подпись главной кнопки визарда зависит от трёх вещей сразу (последний шаг,
// заполненность, обязательность) — раньше эта развилка жила в двух копиях,
// и правка доезжала до одной. Тест держит её в одном месте.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DiaryWizardNav } from './DiaryWizardNav';

afterEach(() => cleanup());

const base = {
  accentColor: '#9a5b3e',
  step: 1,
  onStep: vi.fn(),
  isLast: false,
  filled: false,
  optional: true,
  canNext: true,
  canSave: true,
  saving: false,
  onSave: vi.fn(),
};

describe('DiaryWizardNav', () => {
  it('пустой необязательный шаг предлагает пропустить', () => {
    render(<DiaryWizardNav {...base} />);
    expect(screen.getByText('Пропустить')).toBeTruthy();
  });

  it('как только в шаге что-то есть — это уже «Далее»', () => {
    render(<DiaryWizardNav {...base} filled />);
    expect(screen.getByText('Далее →')).toBeTruthy();
  });

  it('обязательный шаг не предлагают пропустить даже пустым', () => {
    render(<DiaryWizardNav {...base} optional={false} />);
    expect(screen.getByText('Далее →')).toBeTruthy();
  });

  it('последний шаг сохраняет, а не ведёт дальше', () => {
    const onSave = vi.fn();
    render(<DiaryWizardNav {...base} isLast onSave={onSave} />);
    fireEvent.click(screen.getByText('Готово'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('на последнем шаге без права сохранить кнопка выключена', () => {
    render(<DiaryWizardNav {...base} isLast canSave={false} />);
    expect(screen.getByText('Готово').hasAttribute('disabled')).toBe(true);
  });

  it('во время сохранения говорит, что сохраняет, и не даёт нажать снова', () => {
    render(<DiaryWizardNav {...base} isLast saving />);
    expect(screen.getByText('Сохраняю…').hasAttribute('disabled')).toBe(true);
  });

  it('шаги листаются в обе стороны, с первого назад — некуда', () => {
    const onStep = vi.fn();
    render(<DiaryWizardNav {...base} onStep={onStep} />);
    fireEvent.click(screen.getByText('Пропустить'));
    expect(onStep).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByText('←'));
    expect(onStep).toHaveBeenCalledWith(0);

    cleanup();
    onStep.mockClear();
    render(<DiaryWizardNav {...base} step={0} onStep={onStep} />);
    expect(screen.getByText('←').hasAttribute('disabled')).toBe(true);
  });
});
