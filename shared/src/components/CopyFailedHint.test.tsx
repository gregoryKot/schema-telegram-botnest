// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CopyFailedHint } from './CopyFailedHint';

afterEach(() => {
  cleanup();
});

describe('CopyFailedHint', () => {
  it('show=false — ничего не рендерит', () => {
    const { container } = render(<CopyFailedHint show={false} />);
    expect(container.textContent).toBe('');
  });

  it('show=true, без tr — берёт форму из контекста (дефолт «ты»)', () => {
    render(<CopyFailedHint show={true} />);
    expect(
      screen.getByText('Не удалось скопировать — скопируй вручную'),
    ).toBeTruthy();
  });

  it('show=true, с override tr — использует переданную функцию, не контекст', () => {
    const tr = (ty: string, vy: string) => `${ty}|${vy}`;
    render(<CopyFailedHint show={true} tr={tr} />);
    expect(
      screen.getByText(
        (c) =>
          c.includes('скопируй вручную') && c.includes('скопируйте вручную'),
      ),
    ).toBeTruthy();
  });
});
