// @vitest-environment jsdom
// Каркас листа (GuideSheet.tsx): свёртка длинного пункта, тихие метки книг.
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

  // Регресс #1590 на проде: в шаге-grid «ещё» висело отдельной ячейкой, раскрытый текст — колонкой в слово.
  it('в шаге всё тело — один элемент рядом с номером, «ещё» раскрывает остаток внутри него', () => {
    render(<GuidePoints items={[LONG]} ordered />);
    const step = screen.getByRole('listitem');
    expect(step.children).toHaveLength(1);
    const body = step.children[0];
    fireEvent.click(within(body as HTMLElement).getByRole('button', { name: 'ещё' }));
    expect(body.contains(screen.getByText(/Вторая фраза/))).toBe(true);
    expect(screen.getByText(/Вторая фраза/).closest('[hidden]')).toBeNull();
  });

  it('браузер с beforematch: остаток под until-found, «ещё» снимает его', () => {
    Object.defineProperty(HTMLElement.prototype, 'onbeforematch', { value: null, configurable: true, writable: true });
    try {
      render(<GuidePoints items={[LONG]} />);
      const rest = screen.getByText(/Вторая фраза/).closest('.gd-fold-rest')!;
      expect(rest.getAttribute('hidden')).toBe('until-found');
      fireEvent.click(screen.getByRole('button', { name: 'ещё' }));
      expect(rest.hasAttribute('hidden')).toBe(false);
    } finally {
      delete (HTMLElement.prototype as { onbeforematch?: unknown }).onbeforematch;
    }
  });
});
