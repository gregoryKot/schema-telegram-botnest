// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sign, SignHead, type SignKind } from './SignArt';

const KINDS: SignKind[] = ['talk', 'pebbles', 'check', 'layers', 'cluster', 'strokes', 'heart'];

describe('SignArt', () => {
  it.each(KINDS)('знак %s рисует декоративную картинку в строке', (kind) => {
    const { container } = render(<Sign kind={kind} />);
    expect(container.querySelector('.pp-row-art svg')).not.toBeNull();
  });

  it('SignHead сохраняет тег и класс подписи, знак слева от текста', () => {
    const { getByRole } = render(<SignHead kind="heart" className="ds-h2">Требуют внимания</SignHead>);
    const h = getByRole('heading', { level: 2, name: 'Требуют внимания' });
    expect(h.className).toContain('ds-h2');
    expect(h.firstElementChild?.className).toContain('pp-row-art');
  });
});
