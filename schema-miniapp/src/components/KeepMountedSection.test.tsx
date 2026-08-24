// @vitest-environment jsdom
// KeepMountedSection — вкладки не перемонтируются при переключении (замер
// 2026-08-24: перемонтирование = ~100мс мёртвых + мигание скелетоном +
// повторный тяжёлый коммит на каждый тап; «стало хуже» после #422).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { KeepMountedSection } from './KeepMountedSection';

function Probe({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);
  return <div>probe-content</div>;
}

describe('KeepMountedSection', () => {
  it('не рендерит ничего, пока вкладку ни разу не открыли', () => {
    const onMount = vi.fn();
    render(
      <KeepMountedSection active={false}>
        <Probe onMount={onMount} />
      </KeepMountedSection>,
    );
    expect(screen.queryByText('probe-content')).toBeNull();
    expect(onMount).not.toHaveBeenCalled();
  });

  it('после первого открытия скрытие НЕ размонтирует: контент жив, но спрятан', () => {
    const onMount = vi.fn();
    const ui = (active: boolean) => (
      <KeepMountedSection active={active}>
        <Probe onMount={onMount} />
      </KeepMountedSection>
    );
    const wrapperOf = (el: Element) => el.parentElement as HTMLElement;
    const { rerender } = render(ui(true));
    expect(wrapperOf(screen.getByText('probe-content')).hidden).toBe(false);
    expect(onMount).toHaveBeenCalledTimes(1);

    rerender(ui(false));
    // Контент в DOM (не размонтирован), но скрыт (display:none + hidden).
    const el = screen.getByText('probe-content');
    expect(wrapperOf(el).hidden).toBe(true);
    expect(wrapperOf(el).style.display).toBe('none');

    rerender(ui(true));
    expect(wrapperOf(screen.getByText('probe-content')).hidden).toBe(false);
    // Главное: возврат — БЕЗ повторного маунта (нет второго вызова эффекта).
    expect(onMount).toHaveBeenCalledTimes(1);
  });
});
