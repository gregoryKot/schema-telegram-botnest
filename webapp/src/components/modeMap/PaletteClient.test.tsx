// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaletteClient } from './PaletteClient';
import { ModeMapConceptContext, type ClientConceptState } from './clientConceptContext';

const renderBlock = (state: ClientConceptState) => render(
  <ModeMapConceptContext.Provider value={state}><PaletteClient onAdd={vi.fn()} onAddMany={vi.fn()} /></ModeMapConceptContext.Provider>,
);

describe('PaletteClient — блок «Этот клиент»', () => {
  it('пока концептуализация грузится — скелетон строк, а не «пусто»', () => {
    const { container } = renderBlock(null);
    expect(container.querySelectorAll('.mm2-pal-skel .skel')).toHaveLength(3);
    expect(screen.queryByText(/появятся здесь/)).toBeNull();
  });

  it('только неизвестные id — как пустая концептуализация', () => {
    renderBlock({ schemaIds: ['no_such_schema'], modeIds: ['no_such_mode'], modeLinks: [] });
    expect(screen.getByText('Режимы и схемы из концептуализации появятся здесь')).toBeTruthy();
  });

  it('есть только схемы — секции режимов и «+ все» нет', () => {
    renderBlock({ schemaIds: ['mistrust'], modeIds: [], modeLinks: [] });
    expect(screen.getByText('Недоверие / Ожидание жестокого обращения')).toBeTruthy();
    expect(screen.queryByText('Режимы')).toBeNull();
    expect(screen.queryByLabelText('Вынести все режимы клиента на карту')).toBeNull();
  });
});
