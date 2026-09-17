// @vitest-environment jsdom
// Скелет раскрывающейся секции листа потребности. До распила он был
// скопирован трижды внутри NeedTodaySheet; теперь это один примитив, и его
// поведение (что видно, куда смотрит стрелка, что тело не рендерится
// закрытым) проверяется здесь напрямую, а не через три экранных сценария.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CollapsibleSection } from './CollapsibleSection';

afterEach(cleanup);

function renderSection(open: boolean) {
  const onToggle = vi.fn();
  render(
    <CollapsibleSection
      label="Как понять оценку"
      open={open}
      onToggle={onToggle}
    >
      <div>тело секции</div>
    </CollapsibleSection>,
  );
  return { onToggle };
}

describe('CollapsibleSection', () => {
  it('закрытая: подпись видна, тело не отрендерено, стрелка вниз', () => {
    renderSection(false);
    expect(screen.getByText('Как понять оценку')).toBeTruthy();
    // Именно не отрендерено, а не просто спрятано стилем: закрытая секция не
    // должна тянуть за собой разметку тела.
    expect(screen.queryByText('тело секции')).toBeNull();
    expect(screen.getByText('▾')).toBeTruthy();
  });

  it('открытая: тело отрендерено, стрелка вверх', () => {
    renderSection(true);
    expect(screen.getByText('тело секции')).toBeTruthy();
    expect(screen.getByText('▴')).toBeTruthy();
    expect(screen.queryByText('▾')).toBeNull();
  });

  it('клик по заголовку зовёт onToggle, но сам состояние не меняет', () => {
    const { onToggle } = renderSection(false);
    fireEvent.click(screen.getByText('Как понять оценку'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    // Состояние живёт у родителя — примитив остаётся закрытым, пока проп не
    // сменится. Иначе две раскрывашки разъехались бы с родительским стейтом.
    expect(screen.queryByText('тело секции')).toBeNull();
  });
});
