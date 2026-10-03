// @vitest-environment jsdom
// Тело пошагового листа сайта (editorial): без эмодзи-иллюстрации, эйбрау
// «Шаг N из M»; логика шагов — та же useStepFlow, что у StepFlowBody мини-аппа.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StepFlowSiteBody } from './StepFlowSiteBody';
import type { FlowStep, StepFlowProps } from './stepFlowTypes';

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
    <StepFlowSiteBody
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

describe('StepFlowSiteBody', () => {
  it('без эмодзи, эйбрау «Шаг N из M», логика шагов та же', () => {
    const onClose = renderFlow();
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

  it('doneExtra только на done-экране', () => {
    renderFlow({ doneExtra: <div>ДополнениеDone</div> });
    expect(screen.queryByText('ДополнениеDone')).toBeNull();
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Готово'));
    expect(screen.getByText('ДополнениеDone')).toBeTruthy();
  });
});
