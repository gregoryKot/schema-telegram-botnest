// @vitest-environment jsdom
// Теги триггеров в «Полях» концептуализации: выбранный тег получает --h,
// иначе .ds-chip--toggle.is-on (фолбэка в var() нет) остаётся без тона.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ConceptTriggers } from './ConceptSectionsText';

describe('ConceptTriggers', () => {
  it('у тегов, в том числе выбранного, задан --h (на себе или предке)', () => {
    const { container } = render(<ConceptTriggers value="Критика" onChange={vi.fn()} placeholder="…" />);
    const on = screen.getByRole('button', { name: 'Критика' });
    expect(on.className).toContain('is-on');
    // нет сущности — нейтральный тон на обёртке тегов (--h наследуется)
    for (const b of container.querySelectorAll<HTMLElement>('.ds-chip--toggle')) {
      const holder = b.closest<HTMLElement>('[style*="--h"]');
      expect(holder?.style.getPropertyValue('--h'), b.textContent ?? '').not.toBe('');
      expect(holder).not.toBeNull();
    }
    cleanup();
  });
});
