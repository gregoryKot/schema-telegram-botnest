// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AboutWhy } from './AboutWhy';
import { NEEDS_EXPLAINER } from '../../../../shared/src/about/aboutData';

afterEach(cleanup);

describe('AboutWhy', () => {
  it('показывает «зачем» (срок результата) и все пять потребностей', () => {
    render(<AboutWhy />);
    expect(screen.getByText(/Через 3–5 дней паттерн/)).toBeTruthy();
    for (const n of NEEDS_EXPLAINER) expect(screen.getByText(new RegExp(n.name))).toBeTruthy();
    expect(NEEDS_EXPLAINER).toHaveLength(5);
  });
});
