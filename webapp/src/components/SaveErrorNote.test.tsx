// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SaveErrorNote } from './SaveErrorNote';

afterEach(cleanup);

describe('SaveErrorNote', () => {
  it('по умолчанию («ты») показывает ты-вариант как alert', () => {
    render(<SaveErrorNote ty="Проверь связь" vy="Проверьте связь" />);
    expect(screen.getByRole('alert').textContent).toBe('Проверь связь');
  });
});
