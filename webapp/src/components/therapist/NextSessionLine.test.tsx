// @vitest-environment jsdom
// Одна форма «ближайшая встреча» в списке клиентов и в шапке карточки (#906):
// ярлык «Встреча» капителью + дата цветом акцента; без даты — «не назначена».
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { NextSessionLine } from './NextSessionLine';

afterEach(cleanup);

describe('NextSessionLine', () => {
  it('с датой: ярлык ds-label «Встреча» и значение акцентом', () => {
    const { container } = render(<NextSessionLine label="Сб, 31 окт · 07:00" />);
    expect(container.querySelector('.ds-label')!.textContent).toBe('Встреча');
    const val = container.querySelector('.tc-meeting-val')!;
    expect(val.textContent).toBe('Сб, 31 окт · 07:00');
    expect(val.className).toBe('tc-meeting-val');
  });

  it('без даты: «не назначена» приглушённо', () => {
    const { container } = render(<NextSessionLine label={null} />);
    const val = container.querySelector('.tc-meeting-val')!;
    expect(val.textContent).toBe('не назначена');
    expect(val.className).toContain('tc-meeting-val--none');
  });
});
