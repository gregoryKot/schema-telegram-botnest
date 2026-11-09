// @vitest-environment jsdom
// «+ режим» в шапке секции схемы — ссылка-кнопка сайта (skin.link = ds-link), а не
// инлайн-копия её вида (docs/open/frontend-ux.md, «Ссылки в shared/ не на ds-link»).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiagramSectionHeader } from './DiagramSectionHeader';
import { ConceptSkinContext, type ConceptSkin } from '../conceptSkin';
import type { DiagramSection } from './diagramTypes';

const SKIN = { link: 'sk-link' } as ConceptSkin;
const SECTION: DiagramSection = {
  id: 'modes',
  title: 'Режимы',
  hint: 'кто включается',
  x: 0,
  y: 0,
  w: 300,
  add: '+ режим',
};

describe('DiagramSectionHeader — кнопка добавления', () => {
  it('со skin: класс ссылки сайта, цвета и рамки инлайном нет; зона 44 остаётся', () => {
    const onAdd = vi.fn();
    render(
      <ConceptSkinContext.Provider value={SKIN}>
        <DiagramSectionHeader section={SECTION} open={false} onAdd={onAdd} />
      </ConceptSkinContext.Provider>,
    );
    const btn = screen.getByRole('button', { name: '+ режим' });
    expect(btn.className).toBe('sk-link');
    expect(btn.style.color).toBe('');
    expect(btn.style.background).toBe('');
    expect(btn.style.fontSize).toBe('');
    expect(btn.style.minHeight).toBe('44px');
    fireEvent.click(btn);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('без skin — прежний инлайн-вид; открыта — «Свернуть»', () => {
    render(<DiagramSectionHeader section={SECTION} open onAdd={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Свернуть' });
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.style.color).toBe('var(--accent)');
  });

  it('без onAdd кнопки нет', () => {
    render(<DiagramSectionHeader section={SECTION} open={false} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
