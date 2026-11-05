// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PatternSign } from './PatternSign';

describe('PatternSign', () => {
  it('схема и режим — разные знаки', () => {
    const a = render(<PatternSign kind="schema" />);
    const b = render(<PatternSign kind="mode" />);
    const sa = a.container.querySelector('svg');
    const sb = b.container.querySelector('svg');
    expect(sa).toBeTruthy();
    expect(sb).toBeTruthy();
    expect(sa!.innerHTML).not.toBe(sb!.innerHTML);
  });
});
