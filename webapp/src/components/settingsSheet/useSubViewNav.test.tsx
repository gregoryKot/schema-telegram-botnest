// @vitest-environment jsdom
// Возврат из подэкрана: главный вид размонтировался — прокрутка и фокус восстанавливаются по памяти.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useSubViewNav } from './useSubViewNav';

afterEach(cleanup);

function Harness() {
  const { view, open, close, scrollRef } = useSubViewNav();
  if (view !== 'main') return <button onClick={close}>назад из {view}</button>;
  return (
    <div ref={scrollRef} data-testid="scroll">
      <button data-opens="time" onClick={() => open('time')}>Время</button>
      <button data-opens="tz" onClick={() => open('tz')}>Часовой пояс</button>
    </div>
  );
}

describe('useSubViewNav', () => {
  it('возврат ставит прокрутку на прежнее место и фокус — на строку, открывшую подэкран', () => {
    render(<Harness />);
    screen.getByTestId('scroll').scrollTop = 420;
    fireEvent.click(screen.getByText('Часовой пояс'));
    fireEvent.click(screen.getByText('назад из tz'));
    expect(screen.getByTestId('scroll').scrollTop).toBe(420);
    expect(document.activeElement).toBe(screen.getByText('Часовой пояс'));
  });

  it('первый показ главного вида ничего не трогает: фокус и прокрутка как есть', () => {
    render(<Harness />);
    expect(screen.getByTestId('scroll').scrollTop).toBe(0);
    expect(document.activeElement).toBe(document.body);
  });
});
