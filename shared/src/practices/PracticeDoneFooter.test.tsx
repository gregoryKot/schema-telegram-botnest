// @vitest-environment jsdom
// practiceCountLabel + подвал завершённой практики: держит правило «никаких
// хардкод-заглушек вместо реальных данных» (null/0/отрицательное — счётчик
// не показывается, а не выдуманный ноль) и точные формы русского
// плюрализма — их легко сломать одной цифрой (11 — исключение из общего
// правила «1→one»).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PracticeDoneFooter, practiceCountLabel } from './PracticeDoneFooter';

afterEach(() => cleanup());

describe('practiceCountLabel', () => {
  it('null для null — ещё не известно, показывать нечего', () => {
    expect(practiceCountLabel(null)).toBeNull();
  });

  it('null для 0 и для отрицательных — не выдуманный счётчик', () => {
    expect(practiceCountLabel(0)).toBeNull();
    expect(practiceCountLabel(-1)).toBeNull();
    expect(practiceCountLabel(-5)).toBeNull();
  });

  it.each<[number, string]>([
    [1, 'прошли 1 раз'],
    [3, 'прошли 3 раза'],
    [5, 'прошли 5 раз'],
    [11, 'прошли 11 раз'],
    [21, 'прошли 21 раз'],
    [22, 'прошли 22 раза'],
  ])('%i → "%s"', (count, expected) => {
    expect(practiceCountLabel(count)).toBe(expected);
  });
});

describe('PracticeDoneFooter — счётчик', () => {
  it('скрыт, когда count — null (ещё не загружен)', () => {
    render(<PracticeDoneFooter count={null} onShare={vi.fn()} />);
    expect(screen.queryByText(/Пройдено уже/)).toBeNull();
  });

  it('скрыт при count=0 — не выдуманный ноль', () => {
    render(<PracticeDoneFooter count={0} onShare={vi.fn()} />);
    expect(screen.queryByText(/Пройдено уже/)).toBeNull();
  });

  it('показывается при положительном значении, форма плюрализма верная', () => {
    render(<PracticeDoneFooter count={3} onShare={vi.fn()} />);
    expect(screen.getByText(/Пройдено уже 3 раза/)).toBeTruthy();
  });
});

describe('PracticeDoneFooter — колбэки', () => {
  it('onShown зовётся ровно один раз при показе подвала', () => {
    const onShown = vi.fn();
    render(
      <PracticeDoneFooter count={1} onShare={vi.fn()} onShown={onShown} />,
    );
    expect(onShown).toHaveBeenCalledTimes(1);
  });

  it('«Поделиться» зовёт onShare', () => {
    const onShare = vi.fn();
    render(<PracticeDoneFooter count={1} onShare={onShare} />);
    fireEvent.click(screen.getByText('Поделиться'));
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
