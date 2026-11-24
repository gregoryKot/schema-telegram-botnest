// @vitest-environment jsdom
// Два уровня техник на листе режима и схемы: главные «На сессии» на виду, «Ещё техники» свёрнуты
// и по тапу ведут в лист техники так же, как главные. Пусто — блока нет.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModeGuideSheet } from './ModeGuideSheet';
import { MORE_TECHNIQUES_TITLE } from '../../../../../shared/src/schemaTherapy/guide/address/addressTitles';
import { FIXTURE_TECHNIQUES, FIXTURE_VIEW } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';

const [main, extra] = FIXTURE_TECHNIQUES;

function renderMode(moreTechniques = [extra]) {
  const onOpenTechnique = vi.fn();
  render(
    <MemoryRouter>
      <ModeGuideSheet modeName="Режим" view={{ ...FIXTURE_VIEW, techniques: [main], moreTechniques }} onOpenTechnique={onOpenTechnique} onClose={() => {}} />
    </MemoryRouter>,
  );
  return { onOpenTechnique };
}

describe('«Ещё техники»', () => {
  it('стоит сразу под «На сессии», свёрнут; по тапу — список, техника открывает свой лист', () => {
    const { onOpenTechnique } = renderMode();
    fireEvent.click(screen.getByRole('tab', { name: 'На сессии' }));
    const regions = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(regions.indexOf(MORE_TECHNIQUES_TITLE)).toBe(regions.indexOf('На сессии') + 1);
    const block = screen.getByRole('region', { name: MORE_TECHNIQUES_TITLE });
    expect(within(block).queryByRole('button', { name: extra.name })).toBeNull();
    fireEvent.click(within(block).getByRole('button', { name: /Показать \(1\)/ }));
    fireEvent.click(within(block).getByRole('button', { name: extra.name }));
    expect(onOpenTechnique).toHaveBeenCalledWith(extra.id);
  });

  it('пустой список — блока нет', () => {
    renderMode([]);
    fireEvent.click(screen.getByRole('tab', { name: 'На сессии' }));
    expect(screen.queryByRole('region', { name: MORE_TECHNIQUES_TITLE })).toBeNull();
  });
});
