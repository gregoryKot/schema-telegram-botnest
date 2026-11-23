// @vitest-environment jsdom
// Каркас листа (GuideSheet.tsx): свёртка длинного пункта, тихие метки книг.
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GuidePage } from './GuideSheet';
import { GuideSection } from './GuideSection';
import { GuidePoints } from './GuidePoints';

const LONG = 'Первая фраза пункта достаточно длинная, чтобы свернуть весь пункт до неё одной и не терять смысл, даже когда вокруг много лишних слов, которые нужны только для длины [Кембридж, гл. 8]. '
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
    expect([...document.querySelectorAll('.gd-cite')].map((e) => e.textContent)).toEqual(['Арнтц ПРЛ', 'Кембридж, гл. 8']);
  });
});
