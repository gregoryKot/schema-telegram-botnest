// @vitest-environment jsdom
// Вкладка «Карта режимов»: на телефоне — строка «на компьютере» вместо холста,
// на компьютере — селектор карт (владелец 2026-11-05).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ModeMapTab, MODE_MAP_DESKTOP_ONLY } from './ModeMapTab';

vi.mock('../ModeMapSelector', () => ({
  ModeMapSelector: ({ clientId }: { clientId: string }) => <div data-testid="selector">{clientId}</div>,
}));

function renderAt(width: number) {
  window.innerWidth = width;
  return render(<ModeMapTab clientId={'42' as never} />);
}

afterEach(() => cleanup());

describe('ModeMapTab', () => {
  it('телефон: вместо холста — подсказка открыть на компьютере, селектор не монтируется', () => {
    renderAt(390);
    expect(screen.getByText(MODE_MAP_DESKTOP_ONLY)).toBeTruthy();
    expect(screen.queryByTestId('selector')).toBeNull();
  });

  it('компьютер: селектор карт, подсказки нет', () => {
    renderAt(1200);
    expect(screen.getByTestId('selector').textContent).toBe('42');
    expect(screen.queryByText(MODE_MAP_DESKTOP_ONLY)).toBeNull();
  });
});
