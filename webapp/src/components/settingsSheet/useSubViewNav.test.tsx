// @vitest-environment jsdom
// Возврат из подэкрана: главный вид размонтировался — прокрутка и фокус восстанавливаются по памяти.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useSubViewNav } from './useSubViewNav';

afterEach(cleanup);

function Harness() {
  const sub = useSubViewNav();
  if (sub.view !== 'main') return <button onClick={sub.close}>назад из {sub.view}</button>;
  return (
    <div ref={sub.scrollRef} data-testid="scroll">
      <div role="button" tabIndex={0} data-opens="time" onClick={() => sub.open('time')}>Время</div>
      <div role="button" tabIndex={0} data-opens="tz" onClick={() => sub.open('tz')}>Часовой пояс</div>
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
