// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { buildPortrait } from '../../../../shared/src/portrait/portraitData';
import { NEED_EXPLAINER_TEXT } from '../../../../shared/src/portrait/portraitTexts';
import { PortraitNeedRows } from './PortraitNeedRows';

afterEach(cleanup);

describe('PortraitNeedRows', () => {
  const needs = buildPortrait({ manualSchemaIds: ['abandonment'] }).needs;

  it('тап раскрывает объяснение потребности, повторный — сворачивает', () => {
    render(<PortraitNeedRows needs={needs} />);
    const rows = screen.getAllByRole('button');
    expect(rows).toHaveLength(5);
    expect(screen.queryByText(NEED_EXPLAINER_TEXT[needs[0].id]!)).toBeNull();
    fireEvent.click(rows[0]);
    expect(rows[0].getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(NEED_EXPLAINER_TEXT[needs[0].id]!)).toBeTruthy();
    fireEvent.click(rows[0]);
    expect(screen.queryByText(NEED_EXPLAINER_TEXT[needs[0].id]!)).toBeNull();
  });

  it('раскрыта одна строка: вторая закрывает первую', () => {
    render(<PortraitNeedRows needs={needs} />);
    const rows = screen.getAllByRole('button');
    fireEvent.click(rows[0]);
    fireEvent.click(rows[1]);
    expect(screen.queryByText(NEED_EXPLAINER_TEXT[needs[0].id]!)).toBeNull();
    expect(screen.getByText(NEED_EXPLAINER_TEXT[needs[1].id]!)).toBeTruthy();
  });
});
