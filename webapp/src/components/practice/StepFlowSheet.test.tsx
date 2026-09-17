// @vitest-environment jsdom
// Пошаговый лист сайта (StepFlowSheet): тело общее с мини-аппом
// (shared/practices/StepFlowBody), но оболочка своя — BottomSheetShell +
// useHistorySheet. Мирроим кейсы schema-miniapp/StepFlowSheet.test.tsx
// (первый шаг, «Дальше», done-экран, «Ещё круг», кастомный repeatLabel), и
// отдельно честно проверяем «Закрыть»: в вебе кнопка ведёт через goBack()
// (navigate(-1)), а не зовёт onClose напрямую — при отсутствии MemoryRouter
// эта связка сломалась бы молча (класс инцидента правила №14).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StepFlowSheet } from './StepFlowSheet';
import type { FlowStep } from '../../../../shared/src/practices/StepFlowBody';

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

function renderFlow(onClose = vi.fn(), extra: Record<string, unknown> = {}) {
  render(
    <MemoryRouter>
      <StepFlowSheet
        title="Тестовая техника"
        subtitle="Подзаголовок листа"
        steps={STEPS}
        done={DONE}
        onClose={onClose}
        {...extra}
      />
    </MemoryRouter>,
  );
  return onClose;
}

describe('StepFlowSheet (webapp)', () => {
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
    renderFlow(vi.fn(), { repeatLabel: 'Повторить снова' });
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Готово'));
    expect(screen.getByText('Повторить снова')).toBeTruthy();
  });

  it('«Закрыть» реально закрывает лист через историю (goBack), а не остаётся молча открытым', () => {
    const onClose = renderFlow();
    fireEvent.click(screen.getByText('Закрыть'));
    // Кнопка внутри StepFlowBody получает goBack (не onClose напрямую) —
    // именно goBack() обязан довести до вызова onClose через попап истории
    // (см. webapp/src/hooks/useHistorySheet.test.tsx: тот же путь для
    // goBack() и для «Назад» браузера).
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
