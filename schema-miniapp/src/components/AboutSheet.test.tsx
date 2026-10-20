// @vitest-environment jsdom
// «Зачем это всё»: абзацы и все пять потребностей из общего контента, переход
// в справочник схем зовёт onOpenSchemaInfo.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AboutSheet } from './AboutSheet';
import { NEEDS_EXPLAINER } from '../aboutData';

afterEach(cleanup);

describe('AboutSheet', () => {
  it('показывает «зачем» и все пять потребностей', () => {
    render(<AboutSheet onClose={vi.fn()} onOpenSchemaInfo={vi.fn()} />);
    expect(screen.getByText('Пять потребностей')).toBeTruthy();
    for (const n of NEEDS_EXPLAINER) expect(screen.getByText(n.name)).toBeTruthy();
    expect(NEEDS_EXPLAINER).toHaveLength(5);
  });

  it('карточка «Схема-терапия» открывает справочник', () => {
    const onOpenSchemaInfo = vi.fn();
    render(<AboutSheet onClose={vi.fn()} onOpenSchemaInfo={onOpenSchemaInfo} />);
    fireEvent.click(screen.getByText('Схема-терапия'));
    expect(onOpenSchemaInfo).toHaveBeenCalledTimes(1);
  });
});
