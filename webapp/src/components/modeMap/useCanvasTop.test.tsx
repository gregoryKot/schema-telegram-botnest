// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { canvasTop, useCanvasTop } from './useCanvasTop';

function Probe({ top }: { top: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useCanvasTop(ref);
  return <div ref={(el) => { ref.current = el; if (el) el.getBoundingClientRect = () => ({ top } as DOMRect); }} data-testid="body" />;
}

describe('useCanvasTop', () => {
  it('верх холста — рамка плюс прокрутка окна: прокрутка замер не меняет', () => {
    expect(canvasTop({ getBoundingClientRect: () => ({ top: 271 } as DOMRect) }, 0)).toBe(271);
    expect(canvasTop({ getBoundingClientRect: () => ({ top: 171 } as DOMRect) }, 100)).toBe(271);
  });

  it('кладёт замер в --mm2-top на элемент', () => {
    const { getByTestId } = render(<Probe top={312} />);
    expect(getByTestId('body').style.getPropertyValue('--mm2-top')).toBe('312px');
  });
});
