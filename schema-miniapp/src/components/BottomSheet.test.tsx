// @vitest-environment jsdom
// Регрессия по фидбеку владельца 2026-08-31 (скрин визарда): у листа без
// ручки (dismissable={false}) контент начинался с нулевого пикселя, и первая
// строка — точки шагов онбординга — въезжала в зону скругления и резалась
// краем экрана. Несворачиваемый лист обязан отбивать контент сверху сам.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BottomSheet } from './BottomSheet';

afterEach(cleanup);

describe('BottomSheet — верх листа', () => {
  it('без ручки (dismissable=false) сверху есть отбивка-спейсер', () => {
    render(
      <BottomSheet dismissable={false}>
        <div>контент</div>
      </BottomSheet>,
    );
    expect(screen.getByTestId('sheet-top-spacer')).toBeTruthy();
  });

  it('с ручкой спейсер не дублируется — отбивку даёт сама ручка', () => {
    render(
      <BottomSheet onClose={() => {}}>
        <div>контент</div>
      </BottomSheet>,
    );
    expect(screen.queryByTestId('sheet-top-spacer')).toBeNull();
    expect(screen.getAllByLabelText('Закрыть').length).toBeGreaterThan(0);
  });
});

// Аудит 2026-10: у каждого смонтированного шита был свой document-слушатель
// Escape, и одно нажатие закрывало все шиты разом (SchemaDescSheet поверх
// ChildhoodWheelSheet тянул за собой finish() нижнего). Тест ходит через
// настоящие BottomSheet и портал, без подставленного стека.
describe('BottomSheet — Escape при нескольких шитах', () => {
  const escape = () => fireEvent.keyDown(document, { key: 'Escape' });

  it('Escape при двух шитах закрывает только верхний', () => {
    const lower = vi.fn();
    const upper = vi.fn();
    render(
      <>
        <BottomSheet onClose={lower}>
          <div>нижний</div>
        </BottomSheet>
        <BottomSheet onClose={upper} zIndex={300}>
          <div>верхний</div>
        </BottomSheet>
      </>,
    );
    escape();
    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();
  });

  it('Escape над dismissable={false} не закрывает шит под ним', () => {
    const lower = vi.fn();
    render(
      <>
        <BottomSheet onClose={lower}>
          <div>нижний</div>
        </BottomSheet>
        <BottomSheet dismissable={false} zIndex={300}>
          <div>без закрытия</div>
        </BottomSheet>
      </>,
    );
    escape();
    expect(lower).not.toHaveBeenCalled();
  });

  it('верхний закрыт — следующий Escape закрывает нижний', () => {
    const lower = vi.fn();
    const upper = vi.fn();
    const Two = ({ withUpper }: { withUpper: boolean }) => (
      <>
        <BottomSheet onClose={lower}>
          <div>нижний</div>
        </BottomSheet>
        {withUpper && (
          <BottomSheet onClose={upper} zIndex={300}>
            <div>верхний</div>
          </BottomSheet>
        )}
      </>
    );
    const { rerender } = render(<Two withUpper />);
    escape();
    rerender(<Two withUpper={false} />);
    escape();
    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).toHaveBeenCalledTimes(1);
  });

  // Другая ветка canDismiss, чем у dismissable={false}: шит поднят без
  // onClose вовсе. Верхний слой без обработчика обязан гасить Escape, а не
  // пропускать его вниз.
  it('Escape над шитом без onClose не закрывает шит под ним', () => {
    const lower = vi.fn();
    render(
      <>
        <BottomSheet onClose={lower}>
          <div>нижний</div>
        </BottomSheet>
        <BottomSheet zIndex={300}>
          <div>верхний без onClose</div>
        </BottomSheet>
      </>,
    );
    escape();
    expect(lower).not.toHaveBeenCalled();
  });
});
