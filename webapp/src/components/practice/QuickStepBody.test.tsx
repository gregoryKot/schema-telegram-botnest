// @vitest-environment jsdom
// Тело пошагового листа (QuickStepBody): лист оттенка практики со знаком, число или буква шага
// крупно, счётчик формой (камешки заземления, буквы «Стопа»), предупреждение — под кнопками на
// всех шагах (лист не меняет высоту, «Дальше» не уезжает); итог — лист «готово» со знаком практики, «Закрыть» главнее «Ещё круг».
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickStepBody } from './QuickStepBody';
import { buildQuickPractice, type QuickPracticeId } from '../../../../shared/src/practices/quickPractices';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

const ty = (t: string) => t;

function renderBody(id: Exclude<QuickPracticeId, 'breathing'>, onClose = vi.fn()) {
  const p = buildQuickPractice(id, ty);
  const view = render(
    <QuickStepBody
      id={id}
      title={p.title}
      subtitle={p.subtitle}
      steps={p.steps}
      done={p.done}
      counter={p.counter}
      doneExtra={<span>подвал</span>}
      note={<span>предупреждение</span>}
      onClose={onClose}
    />,
  );
  return { ...view, onClose };
}

describe('QuickStepBody', () => {
  it('лист — бумага практики из ENTITY_LOOK, знак практики в шапке', () => {
    const { container } = renderBody('grounding');
    const sheet = container.querySelector<HTMLElement>('.qs-sheet');
    expect(sheet?.style.getPropertyValue('--h')).toBe(String(ENTITY_LOOK.grounding.hue));
    expect(container.querySelector('.qs-sign .scn-sign')).not.toBeNull();
  });

  it('заземление: число шага крупно и пять камешков — текущий первый, остальные впереди', () => {
    const { container } = renderBody('grounding');
    expect(container.querySelector('.qs-mark')?.textContent).toBe('5');
    const marks = [...container.querySelectorAll('.qs-pebbles > ellipse[data-mark]')].map((e) => e.getAttribute('data-mark'));
    expect(marks.filter((m) => m === 'now')).toHaveLength(1);
    expect(marks.filter((m) => m === 'next')).toHaveLength(4);
    fireEvent.click(screen.getByText('Дальше'));
    expect(container.querySelector('.qs-mark')?.textContent).toBe('4');
    const after = [...container.querySelectorAll('.qs-pebbles > ellipse[data-mark]')].map((e) => e.getAttribute('data-mark'));
    expect(after.filter((m) => m === 'done')).toHaveLength(1);
  });

  it('«Стоп»: буквы С-Т-О-П счётчиком, текущая — та, что крупно', () => {
    const { container } = renderBody('stop');
    const letters = [...container.querySelectorAll('.qs-letters > li')];
    expect(letters.map((l) => l.textContent)).toEqual(['С', 'Т', 'О', 'П']);
    expect(letters[0].className).toBe('is-now');
    fireEvent.click(screen.getByText('Дальше'));
    expect(container.querySelector('.qs-mark')?.textContent).toBe('Т');
    expect([...container.querySelectorAll('.qs-letters > li')].map((l) => l.className)).toEqual(['is-done', 'is-now', 'is-next', 'is-next']);
  });

  // Ревью g4 r2: предупреждение только на первом шаге — лист короче со второго, «Дальше» уезжало вниз.
  it('предупреждение — под кнопками на каждом шаге, тот же узел (лист не меняет высоту)', () => {
    renderBody('stop');
    const first = screen.getByText('предупреждение');
    expect(first.previousElementSibling?.className).toBe('qs-actions');
    fireEvent.click(screen.getByText('Дальше'));
    expect(screen.getByText('предупреждение')).toBe(first);
  });

  it('итог: сцена «готово» практики, «Закрыть» — залитая, «Ещё круг» — ссылкой и возвращает к первому шагу', () => {
    const { container, onClose } = renderBody('stop');
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Готово'));
    expect(screen.getByText('Итог')).toBeTruthy();
    expect(screen.getByText('подвал')).toBeTruthy();
    expect(container.querySelector('.pa-done-scene svg.scn')).not.toBeNull();
    expect(screen.getByText('Закрыть').className).toContain('ds-btn');
    expect(screen.getByText('Ещё круг').className).toContain('ds-link');
    fireEvent.click(screen.getByText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Ещё круг'));
    expect(container.querySelector('.qs-mark')?.textContent).toBe('С');
  });
});
