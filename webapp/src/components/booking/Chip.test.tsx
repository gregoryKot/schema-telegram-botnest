// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Chip } from './Chip';

describe('Chip визитки', () => {
  it('без подписи — одна строка, выбор в aria-pressed', () => {
    render(<Chip active onClick={vi.fn()}>Сессия</Chip>);
    const btn = screen.getByRole('button', { name: 'Сессия' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.className).not.toContain('pa-chip--note');
  });

  it('с подписью — вторая строка .pa-chip-note и класс pa-chip--note', () => {
    render(<Chip active={false} onClick={vi.fn()} note="50 минут">Сессия</Chip>);
    const btn = screen.getByRole('button', { name: /Сессия/ });
    expect(btn.className).toContain('pa-chip--note');
    expect(btn.querySelector('.pa-chip-note')?.textContent).toBe('50 минут');
  });
});
