// @vitest-environment jsdom
// Каркас листа (GuideSheet.tsx): полоса-оглавление по разделам, свёртка длинного пункта, тихие метки книг.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GuidePage } from './GuideSheet';
import { GuideSection } from './GuideSection';
import { GuidePoints } from './GuidePoints';

const LONG = 'Первая фраза пункта достаточно длинная, чтобы свернуть весь пункт до неё одной и не терять смысл [Кембридж, гл. 8]. '
  + 'Вторая фраза продолжает мысль и уходит под «ещё», пока терапевт не захочет прочитать пункт целиком до конца.';

function page(sections: string[]) {
  return render(
    <MemoryRouter>
      <GuidePage label="Режим" title="Критик" lede="Суть [Арнтц ПРЛ]." sources="" onClose={() => {}}>
        {sections.map((t) => <GuideSection key={t} title={t} text="текст" />)}
        <GuideSection title="Каналы"><GuidePoints items={[LONG]} /></GuideSection>
      </GuidePage>
    </MemoryRouter>,
  );
}

describe('GuidePage: оглавление', () => {
  it('чипы — разделы листа по порядку, тап прокручивает к разделу', () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    page(['Как это звучит', 'Цель']);
    const nav = screen.getByRole('navigation', { name: 'Разделы листа' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Звучит', 'Цель', 'Каналы']);
    fireEvent.click(within(nav).getByRole('button', { name: 'Цель' }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.contexts[0]).toBe(screen.getByRole('region', { name: 'Цель' }));
  });

  it('меньше трёх разделов — полосы нет', () => {
    page(['Цель']);
    expect(screen.queryByRole('navigation', { name: 'Разделы листа' })).toBeNull();
  });
});

describe('GuidePoints: свёртка и метки', () => {
  it('длинный пункт — первая фраза, «ещё» раскрывает остаток', () => {
    page([]);
    const rest = screen.getByText(/Вторая фраза/).closest('span[hidden]');
    expect(rest).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'ещё' }));
    expect(screen.getByText(/Вторая фраза/).closest('[hidden]')).toBeNull();
    expect(screen.getByRole('button', { name: 'свернуть' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('метка книги — тихий span, в герое тоже', () => {
    page([]);
    expect([...document.querySelectorAll('.gd-cite')].map((e) => e.textContent)).toEqual(['[Арнтц ПРЛ]', '[Кембридж, гл. 8]']);
  });
});
