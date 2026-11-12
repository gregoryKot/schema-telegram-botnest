// @vitest-environment jsdom
// Теги триггеров в «Полях» концептуализации: выбранный тег получает --h,
// иначе .ds-chip--toggle.is-on красится запасным нейтральным оттенком, а не тоном раздела.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ConceptTriggers, ConceptNeeds, ConceptCoping, ConceptModes, ConceptProblems } from './ConceptSectionsText';
import { ConceptSectionShell } from './ConceptSectionShell';
import { ConceptModeIdsContext } from './modeChain';

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

describe('«Поля» без цветных плиток', () => {
  const props = { value: '', onChange: vi.fn(), placeholder: '…' };

  it('потребности — ds-chip--toggle с aria-pressed и --h, без tone-tint и tone-border', () => {
    const { container } = render(<ConceptNeeds {...props} />);
    const chips = container.querySelectorAll<HTMLElement>('.ds-chip--toggle');
    expect(chips.length).toBeGreaterThan(0);
    for (const c of chips) {
      expect(c.getAttribute('aria-pressed')).not.toBeNull();
      expect(c.style.getPropertyValue('--h')).not.toBe('');
    }
    expect(container.querySelector('.tone-tint, .tone-border')).toBeNull();
    cleanup();
  });

  it('совладание — карточки без tone-soft и tone-fill', () => {
    const { container } = render(<ConceptCoping {...props} />);
    expect(container.querySelectorAll('.tcp-cop').length).toBe(3);
    expect(container.querySelector('.tone-soft, .tone-fill')).toBeNull();
    cleanup();
  });

  it('режимы — без .ds-card--panel; узел цепочки — бумага группы со знаком группы, стрелка — значком', () => {
    const { container } = render(
      <ConceptModeIdsContext.Provider value={['angry_child', 'detached_protector']}>
        <ConceptModes {...props} />
      </ConceptModeIdsContext.Provider>,
    );
    expect(container.querySelector('.ds-card--panel')).toBeNull();
    const nodes = Array.from(container.querySelectorAll<HTMLElement>('.pp-paper.tcp-node'));
    expect(nodes.map((n) => n.style.getPropertyValue('--h'))).toEqual(['28', '240']);
    for (const n of nodes) expect(n.querySelector('.tcp-node-kind .pp-art--nav')).not.toBeNull();
    expect(container.querySelector('.ds-dot')).toBeNull();
    expect(container.querySelector('.tcp-arrow svg[data-mark="arrow"]')).not.toBeNull();
    expect(container.textContent).not.toContain('→');
    cleanup();
  });

  it('«Проблемы» — textarea.ds-textarea без кавычки', () => {
    const { container } = render(<ConceptProblems {...props} />);
    expect(container.querySelector('textarea.ds-textarea')).not.toBeNull();
    expect(container.textContent).not.toContain('“');
    cleanup();
  });

  it('шапка раздела — номер в .ds-label, заголовок h3.ds-h3', () => {
    const { container } = render(<ConceptSectionShell id="x" n="01" title="Заголовок">тело</ConceptSectionShell>);
    expect(container.querySelector('.ds-label')?.textContent).toBe('01');
    expect(container.querySelector('h3.ds-h3')?.textContent).toBe('Заголовок');
    cleanup();
  });
});
