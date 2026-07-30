// @vitest-environment jsdom
// Общий пошаговый лист (правило «одна механика — один компонент»),
// используется QuickPracticeSheet (заземление и техника «Стоп»). BottomSheet
// рендерит через портал в document.body — screen ищет по всему документу,
// портал прозрачен для теста.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StepFlowSheet, FlowStep } from './StepFlowSheet';

const STEPS: FlowStep[] = [
  { emoji: '1️⃣', title: 'Шаг первый', hint: 'Подсказка первая' },
  { emoji: '2️⃣', title: 'Шаг второй', hint: 'Подсказка вторая' },
];
const DONE: FlowStep = {
  emoji: '✅',
  title: 'Готово, всё получилось',
  hint: 'Можно повторить',
};

afterEach(() => cleanup());

function renderFlow(onClose = vi.fn()) {
  render(
    <StepFlowSheet
      title="Тестовая техника"
      subtitle="Подзаголовок листа"
      steps={STEPS}
      done={DONE}
      onClose={onClose}
    />,
  );
  return onClose;
}

describe('StepFlowSheet', () => {
  it('показывает подзаголовок и первый шаг', () => {
    renderFlow();
    expect(screen.getByText('Подзаголовок листа')).toBeTruthy();
    expect(screen.getByText('Шаг первый')).toBeTruthy();
    expect(screen.getByText('Подсказка первая')).toBeTruthy();
  });

  it('«Дальше» листает к следующему шагу', () => {
    renderFlow();
    fireEvent.click(screen.getByText('Дальше'));
    expect(screen.getByText('Шаг второй')).toBeTruthy();
  });

  it('на последнем шаге кнопка «Готово», по нажатию — done-экран', () => {
    renderFlow();
    fireEvent.click(screen.getByText('Дальше')); // -> шаг 2 (последний)
    expect(screen.getByText('Готово')).toBeTruthy();
    fireEvent.click(screen.getByText('Готово'));
    expect(screen.getByText('Готово, всё получилось')).toBeTruthy();
    expect(screen.getByText('Можно повторить')).toBeTruthy();
    expect(screen.getByText('Ещё круг')).toBeTruthy();
  });

  it('«Ещё круг» сбрасывает на первый шаг', () => {
    renderFlow();
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Готово'));
    fireEvent.click(screen.getByText('Ещё круг'));
    expect(screen.getByText('Шаг первый')).toBeTruthy();
  });

  it('кастомный repeatLabel используется на done-экране', () => {
    render(
      <StepFlowSheet
        title="Тест"
        subtitle="Подзаголовок"
        steps={STEPS}
        done={DONE}
        repeatLabel="Повторить снова"
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Готово'));
    expect(screen.getByText('Повторить снова')).toBeTruthy();
  });

  it('«Закрыть» зовёт onClose', () => {
    const onClose = renderFlow();
    fireEvent.click(screen.getByText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
