import { describe, it, expect } from 'vitest';
import { PALETTE_WIDE_FROM, paletteOpenInitial } from './paletteOpen';

describe('paletteOpenInitial — палитра холста при открытии карты', () => {
  it('широкое окно: раскрыта, пока терапевт её не свернул', () => {
    expect(paletteOpenInitial(null, 1280)).toBe(true);
    expect(paletteOpenInitial('1', 1280)).toBe(true);
    expect(paletteOpenInitial('0', 1280)).toBe(false);
  });
  it('узкое окно (планшет 768): свёрнута при любом сохранённом выборе', () => {
    expect(paletteOpenInitial(null, 768)).toBe(false);
    expect(paletteOpenInitial('1', 768)).toBe(false);
    expect(paletteOpenInitial('1', PALETTE_WIDE_FROM - 1)).toBe(false);
    expect(paletteOpenInitial('1', PALETTE_WIDE_FROM)).toBe(true);
  });
});
