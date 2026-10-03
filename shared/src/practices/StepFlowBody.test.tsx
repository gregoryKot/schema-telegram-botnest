// @vitest-environment jsdom
// Общее тело пошагового листа (правило «одна механика — один компонент»),
// используется QuickPracticeFlow под заземление и технику «Стоп» — площадки
// оборачивают его в свой BottomSheet, здесь только внутренность. Держит:
// первый шаг, «Дальше», done-экран, «Ещё круг», кастомный repeatLabel,
// «Закрыть», и регресс «doneExtra утёк на шаги до done-экрана».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  StepFlowBody,
  type FlowStep,
  type StepFlowProps,
} from './StepFlowBody';

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

function renderFlow(extra: Partial<StepFlowProps> = {}) {
  const onClose = vi.fn();
  render(
    <StepFlowBody
      title="Тестовая техника"
      subtitle="Подзаголовок листа"
      steps={STEPS}
      done={DONE}
      onClose={onClose}
      {...extra}
    />,
  );
  return onClose;
}

describe('StepFlowBody', () => {
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
    renderFlow({ repeatLabel: 'Повторить снова' });
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Готово'));
    expect(screen.getByText('Повторить снова')).toBeTruthy();
  });

  it('«Закрыть» зовёт onClose', () => {
    const onClose = renderFlow();
    fireEvent.click(screen.getByText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('doneExtra рендерится только на done-экране, не раньше (регресс: утекал на шаги)', () => {
    renderFlow({ doneExtra: <div>ДополнениеDone</div> });
    expect(screen.queryByText('ДополнениеDone')).toBeNull();
    fireEvent.click(screen.getByText('Дальше'));
    expect(screen.queryByText('ДополнениеDone')).toBeNull();
    fireEvent.click(screen.getByText('Готово'));
    expect(screen.getByText('ДополнениеDone')).toBeTruthy();
  });
});

describe('StepFlowBody — вариант вёрстки', () => {
  it('app (по умолчанию): эмодзи-иллюстрация есть, «Шаг N из M» нет', () => {
    renderFlow();
    expect(screen.getByText('1️⃣')).toBeTruthy();
    expect(screen.queryByText('Шаг 1 из 2')).toBeNull();
  });

  it('site: без эмодзи, эйбрау «Шаг N из M», логика шагов та же', () => {
    const onClose = renderFlow({ variant: 'site' });
    expect(screen.queryByText('1️⃣')).toBeNull();
    expect(screen.getByText('Шаг 1 из 2')).toBeTruthy();
    expect(screen.getByText('Шаг первый')).toBeTruthy();
    fireEvent.click(screen.getByText('Дальше'));
    expect(screen.getByText('Шаг 2 из 2')).toBeTruthy();
    fireEvent.click(screen.getByText('Готово'));
    expect(screen.queryByText('✅')).toBeNull();
    expect(screen.getByText('Готово, всё получилось')).toBeTruthy();
    expect(screen.getByText('Ещё круг')).toBeTruthy();
    fireEvent.click(screen.getByText('Ещё круг'));
    expect(screen.getByText('Шаг 1 из 2')).toBeTruthy();
    fireEvent.click(screen.getByText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('site: doneExtra только на done-экране', () => {
    renderFlow({ variant: 'site', doneExtra: <div>ДополнениеDone</div> });
    expect(screen.queryByText('ДополнениеDone')).toBeNull();
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Готово'));
    expect(screen.getByText('ДополнениеDone')).toBeTruthy();
  });
});
