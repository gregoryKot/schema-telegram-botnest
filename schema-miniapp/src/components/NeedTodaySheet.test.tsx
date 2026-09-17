// @vitest-environment jsdom
// Экран оценки потребности за сегодня (CLAUDE.md: приоритет №1 покрытия —
// «экраны трекера и оценки потребностей»). Поведение, не разметка: смена
// оценки, раскрытие секций, ветка низкой/высокой оценки, переход в план и
// отсутствие данных для незнакомого id потребности.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NeedTodaySheet } from './NeedTodaySheet';
import { Need } from '../types';

// PlanSheet сам по себе большой (API-вызовы, куратор практик) — здесь важно
// только то, что NeedTodaySheet передаёт ему нужные пропсы и реагирует на
// onSaved/onClose, поэтому подменяем его на минимальный стаб.
vi.mock('./PlanSheet', () => ({
  PlanSheet: ({
    needId,
    onSaved,
    onClose,
  }: {
    needId: string;
    onSaved: () => void;
    onClose: () => void;
  }) => (
    <div data-testid="plan-sheet">
      <span>план для {needId}</span>
      <button onClick={onSaved}>сохранить план</button>
      <button onClick={onClose}>закрыть план</button>
    </div>
  ),
}));

const NEED: Need = {
  id: 'attachment',
  emoji: '🤝',
  title: 'Привязанность',
  chartLabel: 'Привязанность',
};

afterEach(() => {
  cleanup();
});

function renderSheet(
  overrides: Partial<React.ComponentProps<typeof NeedTodaySheet>> = {},
) {
  const onChange = vi.fn();
  const onClose = vi.fn();
  const onPlanSaved = vi.fn();
  const onOpenHelp = vi.fn();
  render(
    <NeedTodaySheet
      need={NEED}
      value={5}
      onChange={onChange}
      onClose={onClose}
      onPlanSaved={onPlanSaved}
      onOpenHelp={onOpenHelp}
      {...overrides}
    />,
  );
  return { onChange, onClose, onPlanSaved, onOpenHelp };
}

describe('NeedTodaySheet', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('неизвестный id потребности — ничего не рендерит (нет данных для показа)', () => {
    const { container } = render(
      <NeedTodaySheet
        need={{ id: 'unknown', emoji: '?', title: 'x', chartLabel: 'x' }}
        value={5}
        onChange={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('среднее значение — без аффирмации высокой оценки, показывает текущее число', () => {
    renderSheet({ value: 5 });
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.queryByText(/сегодня ты позаботился/i)).toBeNull();
  });

  it('высокая оценка (>6) — показывает аффирмацию', () => {
    renderSheet({ value: 8 });
    expect(
      screen.getByText('Сегодня эта потребность получила заботу — заметь это'),
    ).toBeTruthy();
  });

  it('низкая оценка (<=3) — кнопка плана и ссылка на раздел Помощь видны', () => {
    renderSheet({ value: 2 });
    expect(screen.getByText('Сделать завтра что-то для себя')).toBeTruthy();
    expect(screen.getByText('Раздел Помощь')).toBeTruthy();
  });

  it('высокая/средняя оценка — кнопки плана и помощи скрыты', () => {
    renderSheet({ value: 5 });
    expect(screen.queryByText('Сделать завтра что-то для себя')).toBeNull();
  });

  it('клик по «Раздел Помощь» закрывает шит и вызывает onOpenHelp', () => {
    const { onClose, onOpenHelp } = renderSheet({ value: 1 });
    fireEvent.click(screen.getByText('Раздел Помощь'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenHelp).toHaveBeenCalledTimes(1);
  });

  it('без onOpenHelp — ссылка на раздел Помощь не рендерится', () => {
    renderSheet({ value: 1, onOpenHelp: undefined });
    expect(screen.queryByText('Раздел Помощь')).toBeNull();
  });

  it('раскрывает секцию примеров по клику и показывает список', () => {
    renderSheet();
    expect(screen.queryByText(/›/)).toBeNull();
    fireEvent.click(screen.getByText('Как это выглядит в жизни'));
    // после раскрытия должен появиться хотя бы один пример.
    const examples = screen.getAllByText('›');
    expect(examples.length).toBeGreaterThan(0);
  });

  it('раскрывает секцию «Как понять оценку» и клик по диапазону 1–3 меняет значение на 1', () => {
    const { onChange } = renderSheet({ value: 5 });
    fireEvent.click(screen.getByText('Как понять оценку'));
    fireEvent.click(screen.getByText('1–3'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('раскрывает и сворачивает секцию рефлексии', () => {
    renderSheet();
    const question =
      'Есть ли у меня люди или места, которые дают мне чувство безопасности?';
    const toggle = screen.getByText('Вопросы для рефлексии');
    expect(screen.queryByText(question)).toBeNull();

    fireEvent.click(toggle);
    expect(screen.getByText(question)).toBeTruthy();

    fireEvent.click(toggle); // сворачиваем обратно
    expect(screen.queryByText(question)).toBeNull();
  });

  it('клик «Сделать завтра что-то для себя» открывает план, сохранение план вызывает onPlanSaved и onClose', () => {
    const { onPlanSaved, onClose } = renderSheet({ value: 1 });
    fireEvent.click(screen.getByText('Сделать завтра что-то для себя'));
    expect(screen.getByTestId('plan-sheet')).toBeTruthy();
    expect(screen.getByText('план для attachment')).toBeTruthy();

    fireEvent.click(screen.getByText('сохранить план'));
    expect(onPlanSaved).toHaveBeenCalledWith('attachment');
    expect(onClose).toHaveBeenCalledTimes(1);
    // план-шит закрывается после сохранения (unmount стаба).
    expect(screen.queryByTestId('plan-sheet')).toBeNull();
  });

  it('клик «закрыть план» закрывает план-шит, но не основной шит', () => {
    const { onClose } = renderSheet({ value: 1 });
    fireEvent.click(screen.getByText('Сделать завтра что-то для себя'));
    fireEvent.click(screen.getByText('закрыть план'));
    expect(screen.queryByTestId('plan-sheet')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('крестик в шапке закрывает шит', () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
