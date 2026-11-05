// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { hintDomainId } from './hintDomainId';
import { SchemaHintHead } from './SchemaHintHead';

describe('SchemaHintHead', () => {
  it('для каждой потребности находится домен первой схемы', () => {
    for (const id of ['attachment', 'autonomy', 'expression', 'play', 'limits'] as const) {
      expect(hintDomainId(id), id).toBeTruthy();
    }
  });
  it('знак потребности и знак домена, текст на месте', () => {
    const { container, getByText } = render(<SchemaHintHead id="attachment" score={3} />);
    expect(container.querySelectorAll('svg.pp-art--row').length).toBe(2);
    expect(getByText('3/10 в детстве')).toBeTruthy();
    expect(getByText(/Домен: Нарушение связи/)).toBeTruthy();
  });
});
