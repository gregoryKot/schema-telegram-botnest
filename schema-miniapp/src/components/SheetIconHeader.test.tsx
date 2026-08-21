// @vitest-environment jsdom
// В8 дизайн-аудита 2026-08: заголовок шита ресурсов (Тёплые слова, Письмо,
// Безопасное место) — h2, не div.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SheetIconHeader } from './SheetIconHeader';

afterEach(cleanup);

describe('SheetIconHeader', () => {
  it('title — h2, subtitle рядом', () => {
    render(
      <SheetIconHeader title="Тёплые слова" subtitle="Себе, каким я был" />,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Тёплые слова' }),
    ).toBeTruthy();
    expect(screen.getByText('Себе, каким я был')).toBeTruthy();
  });
});
