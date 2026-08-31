// @vitest-environment jsdom
// Регрессия по фидбеку владельца 2026-08-31 (скрин визарда): у листа без
// ручки (dismissable={false}) контент начинался с нулевого пикселя, и первая
// строка — точки шагов онбординга — въезжала в зону скругления и резалась
// краем экрана. Несворачиваемый лист обязан отбивать контент сверху сам.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
